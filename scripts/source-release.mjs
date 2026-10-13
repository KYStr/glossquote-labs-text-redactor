import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, assertDirectory } from './validation.mjs';
import { check } from './check.mjs';
import { checkProduction } from './release.mjs';
import { unpackVerifiedZip } from './zip.mjs';

const toolRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const SOURCE_FILES=Object.freeze([
  '.gitignore','package.json','wrangler.jsonc','README.md','START-HERE.md','HANDOFF.md','project.json',
  'AGENTS.md','PRODUCT.md','TECHNICAL.md','ACCEPTANCE.md','UX-SEO.md','TASKS.md',
  'docs/BRAND.md','docs/DESIGN-SYSTEM.md','docs/ENGINEERING.md','docs/PRIVACY-SECURITY.md','docs/RELEASE.md','docs/RELEASE-CANDIDATE.md',
  ...PUBLIC_FILES.map(name=>'public/'+name),
  ...['serve','check','build','validation','pages','manifest','release','serve-production','source-release','zip'].map(name=>'scripts/'+name+'.mjs'),
  ...['text-redactor','ui-contract','toolchain','release','archive'].map(name=>'test/'+name+'.test.mjs')
].sort());

export function publicSummaries() {
  const note='Only the exact strings you list are replaced. This tool does not detect other personal data; review the full output before sharing.';
  const usage='Node.js 24+; no dependency installation required.\n\n```sh\nnpm test\nnpm run check\nnpm run build\nnpm run build:production\nnpm run check:production\nnpm run dev\n```\n\nPreview: http://127.0.0.1:4204/index.html and /en/index.html; loopback only with occupied-port fallback. Preview is noindex. Production goes to a separate dist-production/ directory.\n';
  return new Map([
    ['README.md',`# Custom Text Redactor / 自訂文字遮蔽\n\n${note}\n\nExact, case- and space-sensitive, longest-match-first, non-overlapping replacement with the fixed token [REDACTED]. Text stays in the current browser tab by design. No account, runtime packages, remote fonts, analytics or automatic storage. Reloading clears drafts.\n\n${usage}\nProduction origin: https://redact.glossquote.com. Source release candidate; live deployment and bilingual homepage inclusion are separate primary-owned gates and are not verified by this repository.\n\nLimits: source 100000 UTF-16 units; 1–50 targets, 1–200 units each. Empty/duplicate/control/unpaired-surrogate targets are rejected. Source and targets are never trimmed or normalized. Copy/download contains only the output.\n\nTesting evidence: M1 owner and independent primary offline tests 44/44 passed. Native clipboard, bilingual flows, keyboard and measured 320px passed. Downloaded file bytes, actual 200% browser zoom, full Network/Storage, physical device/IME/assistive technology and BFCache/pending OS clipboard ordering remain NOT_RUN. M2 release tests cover production metadata, headers, 404, safe builds and fixed-source archive verification. Mock tests do not replace native checks.\n\nOriginal specification status labels describe the initial contract; current release status is here and in HANDOFF.md. No license grant is inferred from public source publication.\n`],
    ['START-HERE.md',`# Start here\n\n${note}\n\n${usage}\nRead PRODUCT.md, TECHNICAL.md, ACCEPTANCE.md and docs/ before changes. Production static assets are built for the exact origin https://redact.glossquote.com, with canonical URLs /index.html and /en/index.html, reciprocal hreflang, JSON-LD, robots/sitemap, bilingual 404 and security headers. Hosting and external review are NOT_RUN in this source candidate.\n`],
    ['HANDOFF.md',`# Source release handoff\n\nVersion 0.1.0. M1 independent primary acceptance passed with explicit native NOT_RUN items. M1 browser/runtime bytes are frozen; M2 adds head metadata and independent production assets/tooling.\n\n${note}\n\nSource repository: https://github.com/KYStr/glossquote-labs-text-redactor. The commit and its Git blobs identify this source snapshot; generate production assets from those bytes. Local preview and source publication do not prove live hosting. Cloudflare deployment, bilingual family homepage inclusion and external confirmation remain separate gates.\n\nNative NOT_RUN: downloaded file name/UTF-8 bytes, actual 200% browser zoom, full Network/Storage, physical phone/IME/assistive technology, and BFCache/pending OS clipboard ordering. Preserve these statuses.\n\n${usage}\nPublication must use a reviewed independent copy, per-command Git options and existing CLI authentication. Never configure global/system Git or authentication, expose credentials, or infer a source license.\n`],
    ['project.json',JSON.stringify({schemaVersion:1,id:'24-text-redactor',slug:'text-redactor',title:'自訂文字遮蔽',version:'0.1.0',sourceRepository:'https://github.com/KYStr/glossquote-labs-text-redactor',productionOrigin:'https://redact.glossquote.com',M1:'primary-accepted-with-explicit-not-run',M2:'source-release-candidate',hosting:'not-deployed-by-this-source-task',externalReview:'not-run',runtimeDependencies:0},null,2)+'\n']
  ]);
}
async function sourceFile(root,name) {
  await assertDirectory(root);
  let current=root;
  const parts=name.split('/');
  for(const [index,part] of parts.entries()) {
    current=path.join(current,part);
    const stat=await lstat(current);
    if(stat.isSymbolicLink()) throw new Error('SOURCE_LINK');
    if(index<parts.length-1) await assertDirectory(current);
    else if(!stat.isFile() || stat.nlink!==1) throw new Error('SOURCE_UNSAFE_FILE');
  }
  return current;
}
export async function stageSource(destination,root=toolRoot) {
  await check(root); await checkProduction(root);
  await assertDirectory(path.dirname(destination));
  try { await lstat(destination); throw new Error('PUBLISH_COPY_EXISTS'); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  const summaries=publicSummaries();
  const contents=await Promise.all(SOURCE_FILES.map(async name=>[name,summaries.has(name)?Buffer.from(summaries.get(name)):await readFile(await sourceFile(root,name))]));
  await mkdir(destination); await assertDirectory(destination);
  for(const [name,bytes] of contents) {
    const target=path.join(destination,name); await mkdir(path.dirname(target),{recursive:true}); await assertDirectory(path.dirname(target)); await writeFile(target,bytes,{flag:'wx'});
  }
  return validatePublicSource(destination);
}
export async function validatePublicSource(root) {
  const found=[];
  async function walk(directory,prefix='') {
    for(const item of await readdir(directory,{withFileTypes:true})) {
      const name=prefix+item.name;
      if(['.git','dist','dist-production','test/.tmp','.wrangler'].includes(name)) continue;
      const stat=await lstat(path.join(directory,item.name));
      if(stat.isSymbolicLink()) throw new Error('PUBLISH_LINK');
      if(stat.isDirectory()) { await assertDirectory(path.join(directory,item.name)); await walk(path.join(directory,item.name),name+'/'); }
      else { if(!SOURCE_FILES.includes(name)) throw new Error('PUBLISH_UNKNOWN_FILE'); await sourceFile(root,name); found.push(name); }
    }
  }
  await assertDirectory(root); await walk(root);
  if(JSON.stringify(found.sort())!==JSON.stringify(SOURCE_FILES)) throw new Error('PUBLISH_MISSING_FILE');
  for(const name of found) {
    const text=(await readFile(await sourceFile(root,name))).toString('utf8');
    if(/\b01a[0-9a-f]{5}-[0-9a-f-]{27,}\b|C:[/\\]Users[/\\]|glossquote-cloudflare\.token|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|BEGIN [A-Z ]*PRIVATE KEY/.test(text)) throw new Error('PRIVATE_OR_SECRET_SOURCE');
  }
  for(const [name,text] of publicSummaries()) if((await readFile(path.join(root,name),'utf8'))!==text) throw new Error('PUBLIC_SUMMARY_DRIFT');
  await check(root);
  return {status:'PASS',files:found.length,privateMetadata:'excluded',runtimeDependencies:0};
}
export async function verifyGitZip({git,copy,commit,archive,unpacked}) {
  if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error('FIXED_COMMIT_REQUIRED');
  const run=args=> {
    const value=spawnSync(git,['-c','core.autocrlf=false','-c','core.hooksPath=',...args],{cwd:copy,maxBuffer:10000000});
    if(value.status!==0) throw new Error('GIT_BLOB_READ_FAILED'); return value.stdout;
  };
  const tree=run(['ls-tree','-r','-z','--full-tree',commit]).toString('utf8').split('\0').filter(Boolean);
  const blobs=new Map(), records=[];
  for(const line of tree) {
    const match=/^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
    if(!match || !SOURCE_FILES.includes(match[2])) throw new Error('UNREVIEWED_GIT_TREE');
    const bytes=run(['cat-file','blob',match[1]]); blobs.set(match[2],bytes); records.push({path:match[2],gitBlob:match[1]});
    if(!bytes.equals(await readFile(await sourceFile(copy,match[2])))) throw new Error('GIT_COPY_DRIFT');
  }
  if(blobs.size!==SOURCE_FILES.length) throw new Error('GIT_TREE_MISSING_FILE');
  const result=await unpackVerifiedZip(await readFile(archive),blobs,unpacked);
  for(const record of result.manifest) record.gitBlob=records.find(x=>x.path===record.path).gitBlob;
  await validatePublicSource(unpacked);
  return {status:'PASS',commit,...result};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,target,...extra]=process.argv.slice(2);
  if(!target || extra.length || !['stage','check'].includes(mode)) throw new Error('SOURCE_RELEASE_ARGUMENTS');
  process.stdout.write(JSON.stringify(mode==='stage'?await stageSource(path.resolve(target)):await validatePublicSource(path.resolve(target)))+'\n');
}
