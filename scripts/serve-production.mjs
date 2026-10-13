import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_FILES, productionHeaders } from './release.mjs';
import { safeFile, validateTree } from './validation.mjs';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function createProductionPreview({root=path.join(toolRoot,'dist-production'),port=5204}={}) {
  await validateTree(root,{files:PRODUCTION_FILES});
  const server = http.createServer(async(request,response) => {
    const headers = productionHeaders();
    const method = request.method;
    const raw = request.url ?? '';
    if (!['GET','HEAD'].includes(method)) { response.writeHead(405,{...headers,Allow:'GET, HEAD'}); return response.end(method === 'HEAD' ? undefined : 'Method not allowed'); }
    if (!raw.startsWith('/') || /[?#%\\]/.test(raw)) { response.writeHead(400,headers); return response.end(method === 'HEAD' ? undefined : 'Invalid path'); }
    const redirect = raw === '/' ? '/index.html' : (raw === '/en' || raw === '/en/') ? '/en/index.html' : null;
    if (redirect) { response.writeHead(301,{...headers,Location:redirect}); return response.end(); }
    let file = raw.slice(1);
    let status = 200;
    if (!PRODUCTION_FILES.includes(file) || file.startsWith('_') || file.split('/').some(x=>x.startsWith('.'))) {
      file = raw.startsWith('/en/') ? 'en/404.html' : '404.html'; status = 404;
    }
    try {
      const bytes = await readFile(await safeFile(root,file,PRODUCTION_FILES));
      const types = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
      response.writeHead(status,{...headers,'Content-Type':types[path.extname(file)],'Content-Length':bytes.length,
        ...(file.endsWith('404.html') ? {'X-Robots-Tag':'noindex, nofollow'} : {})});
      response.end(method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404,headers); response.end(); }
  });
  const listen = requested => new Promise((resolve,reject) => {
    const failed = error => { server.removeListener('listening',ready); reject(error); };
    const ready = () => { server.removeListener('error',failed); resolve(); };
    server.once('error',failed); server.once('listening',ready); server.listen(requested,'127.0.0.1');
  });
  try { await listen(port); } catch(error) { if(error.code !== 'EADDRINUSE' || !port) throw error; await listen(0); }
  return {server,port:server.address().port};
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const value = await createProductionPreview(); process.stdout.write(`Local production model: http://127.0.0.1:${value.port}/index.html\n`); }
  catch { process.stderr.write('PRODUCTION_PREVIEW_FAILED\n'); process.exitCode=1; }
}
