import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, safeFile, validateTree, requireNode24 } from './validation.mjs';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};
export const previewHeaders = Object.freeze({
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
});

export async function createPreview({ root = path.join(toolRoot, 'public'), port = 4204 } = {}) {
  requireNode24();
  await validateTree(root);
  const server = http.createServer(async (request, response) => {
    const respond = (status, message) => {
      response.writeHead(status, { ...previewHeaders, 'Content-Type': 'text/plain; charset=utf-8',
        ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') return respond(405, 'Method not allowed');
    // Raw request target only: URL parsers can normalize traversal before the allowlist.
    const raw = request.url ?? '';
    if (raw.includes('?') || raw.includes('#') || raw.includes('%') || raw.includes('\\')) return respond(400, 'Invalid path');
    let relative = raw === '/' ? 'index.html' : raw === '/en/' ? 'en/index.html' : raw.slice(1);
    if (!raw.startsWith('/') || !PUBLIC_FILES.includes(relative)) return respond(404, 'Not found');
    try {
      const data = await readFile(await safeFile(root, relative));
      response.writeHead(200, { ...previewHeaders, 'Content-Type': contentTypes[path.extname(relative)],
        'Content-Length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch {
      respond(404, 'Not found');
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  const listen = requestedPort => new Promise((resolve, reject) => {
    const error = value => { server.removeListener('listening', listening); reject(value); };
    const listening = () => { server.removeListener('error', error); resolve(); };
    server.once('error', error);
    server.once('listening', listening);
    server.listen(requestedPort, '127.0.0.1');
  });
  let fallback = false;
  try { await listen(port); } catch (error) {
    if (error.code !== 'EADDRINUSE' || port === 0) throw error;
    fallback = true;
    await listen(0);
  }
  return { server, port: server.address().port, host: '127.0.0.1', fallback };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const preview = await createPreview();
    process.stdout.write(`Preview: http://127.0.0.1:${preview.port}/index.html\nEnglish: http://127.0.0.1:${preview.port}/en/index.html\nPort fallback: ${preview.fallback}\n`);
  } catch {
    process.stderr.write('PREVIEW_START_FAILED\n');
    process.exitCode = 1;
  }
}
