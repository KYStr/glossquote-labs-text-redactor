import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm, realpath, link, symlink } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProduction, expectedProduction, checkProduction, PRODUCTION_FILES, M1_SHA256, sha256, ORIGIN } from '../scripts/release.mjs';
import { createProductionPreview } from '../scripts/serve-production.mjs';
import { PUBLIC_FILES } from '../scripts/validation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parent=path.join(root,'test','.tmp');
async function fixture(run) {
  await mkdir(parent,{recursive:true}); const temp=await mkdtemp(path.join(parent,'release-'));
  try {
    for(const name of PUBLIC_FILES) { const target=path.join(temp,'public',name); await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,await readFile(path.join(root,'public',name))); }
    await writeFile(path.join(temp,'wrangler.jsonc'),await readFile(path.join(root,'wrangler.jsonc')));
    await run(temp);
  } finally { assert.ok((await realpath(temp)).toLowerCase().startsWith(parent.toLowerCase()+path.sep)); await rm(temp,{recursive:true,force:true}); }
}
const request=(port,url,method='GET')=>new Promise((resolve,reject)=> {
  const req=http.request({hostname:'127.0.0.1',port,path:url,method},res=> {const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString('utf8')}));});req.on('error',reject);req.end();
});
test('M2 preserves every M1 preview asset and transforms HEAD only',async()=> {
  const generated=await expectedProduction(root);
  for(const name of PUBLIC_FILES) assert.equal(sha256(await readFile(path.join(root,'public',name))),M1_SHA256[name]);
  for(const [name,locale] of [['index.html','zh-Hant'],['en/index.html','en']]) {
    const preview=await readFile(path.join(root,'public',name),'utf8'); const html=generated.get(name).toString('utf8');
    assert.equal(html.slice(html.indexOf('<body>')),preview.slice(preview.indexOf('<body>')));
    assert.ok(html.includes(`rel="canonical" href="${ORIGIN}/${name}"`));
    for(const [lang,url] of [['zh-Hant','index.html'],['en','en/index.html'],['x-default','index.html']]) assert.ok(html.includes(`hreflang="${lang}" href="${ORIGIN}/${url}"`));
    const json=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(json['@type'],'WebApplication'); assert.equal(json.inLanguage,locale); assert.equal(json.url,`${ORIGIN}/${name}`);
    assert.ok(html.includes(json.description)); assert.equal('aggregateRating' in json,false);
    assert.equal(html.includes('noindex'),false); assert.ok(preview.includes('noindex, nofollow')); assert.equal(preview.includes('canonical'),false);
  }
  assert.equal(generated.size,13); assert.equal(generated.get('sitemap.xml').toString().match(/<loc>/g).length,2);
  assert.ok(generated.get('robots.txt').toString().includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
  const headers=generated.get('_headers').toString(); assert.ok(headers.includes("connect-src 'none'")); assert.equal(headers.includes('unsafe-inline'),false);
  assert.equal((headers.match(/sha256-/g)??[]).length,2);
});
test('M2 local production HTTP model: real 404, redirects, exact MIME/headers and no SPA fallback',()=>fixture(async temp=> {
  await buildProduction(temp); assert.equal((await checkProduction(temp)).status,'PASS');
  const {server,port}=await createProductionPreview({root:path.join(temp,'dist-production'),port:0});
  try {
    assert.equal(server.address().address,'127.0.0.1');
    for(const name of PRODUCTION_FILES.filter(x=>!x.startsWith('_'))) { const res=await request(port,'/'+name); assert.equal(res.status,200); assert.equal(res.headers['x-content-type-options'],'nosniff'); assert.equal(res.headers['referrer-policy'],'no-referrer'); assert.ok(res.headers['content-security-policy'].includes("connect-src 'none'")); }
    for(const url of ['/','/en','/en/']) assert.equal((await request(port,url)).status,301);
    for(const url of ['/missing','/en/missing','/js/missing.mjs','/../package.json','/__proto__','/constructor','/toString','/_headers','/_redirects']) {
      const res=await request(port,url); assert.equal(res.status,404); assert.ok(res.body.includes('noindex, nofollow')); assert.equal(res.body.includes('redactor-form'),false);
    }
    assert.ok((await request(port,'/en/missing')).body.includes('Page not found'));
    assert.ok((await request(port,'/missing')).body.includes('找不到頁面'));
    assert.equal((await request(port,'/js/app.mjs')).headers['content-type'],'text/javascript; charset=utf-8');
    assert.equal((await request(port,'/sitemap.xml')).headers['content-type'],'application/xml; charset=utf-8');
    const head=await request(port,'/en/index.html','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
    assert.equal((await request(port,'/index.html','POST')).status,405);
    assert.equal((await request(port,'/%2e%2e/x')).status,400);
  } finally {await new Promise(resolve=>server.close(resolve));}
}));
test('M2 build rejects stale unknown/hardlink/junction before writing; M1 drift fails closed',()=>fixture(async temp=> {
  const sentinel=path.join(temp,'fake-sentinel'); await writeFile(sentinel,'FAKE_UNCHANGED');
  await buildProduction(temp); await writeFile(path.join(temp,'dist-production','unknown'),'FAKE_STALE');
  await assert.rejects(buildProduction(temp),/UNKNOWN_FILE/); assert.equal(await readFile(sentinel,'utf8'),'FAKE_UNCHANGED');
  await rm(path.join(temp,'dist-production','unknown')); await rm(path.join(temp,'dist-production','index.html')); await link(sentinel,path.join(temp,'dist-production','index.html'));
  await assert.rejects(buildProduction(temp),/UNSAFE_FILE/); assert.equal(await readFile(sentinel,'utf8'),'FAKE_UNCHANGED');
  await rm(path.join(temp,'dist-production'),{recursive:true}); await mkdir(path.join(temp,'fake-external')); await symlink(path.join(temp,'fake-external'),path.join(temp,'dist-production'),'junction');
  await assert.rejects(buildProduction(temp),/UNSAFE_DIRECTORY|DIRECTORY_REDIRECT/);
  await writeFile(path.join(temp,'public','js','state.mjs'),'FAKE_DRIFT'); await assert.rejects(expectedProduction(temp),/M1_ASSET_DRIFT/);
}));
