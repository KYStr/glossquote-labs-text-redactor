import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm, realpath, link, symlink } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, validateTree } from '../scripts/validation.mjs';
import { build } from '../scripts/build.mjs';
import { createPreview } from '../scripts/serve.mjs';

const ownedParent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.tmp');
async function fixture(run) {
  await mkdir(ownedParent, { recursive: true });
  const root = await mkdtemp(path.join(ownedParent, 'redactor-'));
  try {
    for (const file of PUBLIC_FILES) {
      const absolute = path.join(root, 'public', file);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, 'FAKE_OFFLINE_' + file);
    }
    await run(root);
  } finally {
    const actual = await realpath(root);
    assert.ok(actual.toLowerCase().startsWith(ownedParent.toLowerCase() + path.sep));
    await rm(root, { recursive: true, force: true });
  }
}
const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
function request(port, target, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.once('error', reject); req.end();
  });
}
test('preview loopback, GET/HEAD only, raw path allowlist, MIME and noindex', () => fixture(async root => {
  const { server, port, host } = await createPreview({ root: path.join(root, 'public'), port: 0 });
  try {
    assert.equal(host, '127.0.0.1'); assert.equal(server.address().address, '127.0.0.1');
    for (const file of PUBLIC_FILES) {
      const result = await request(port, '/' + file);
      assert.equal(result.status, 200); assert.equal(result.body, 'FAKE_OFFLINE_' + file);
      assert.equal(result.headers['x-robots-tag'], 'noindex, nofollow');
      assert.equal(result.headers['x-content-type-options'], 'nosniff');
      assert.ok(result.headers['content-security-policy'].includes("connect-src 'none'"));
    }
    assert.equal((await request(port, '/')).status, 200);
    assert.equal((await request(port, '/en/')).status, 200);
    assert.equal((await request(port, '/js/app.mjs')).headers['content-type'], 'text/javascript; charset=utf-8');
    const head = await request(port, '/index.html', 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, '');
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await request(port, '/', method)).status, 405);
    for (const target of ['/../package.json', '/.env', '/unknown', '/public/index.html']) assert.equal((await request(port, target)).status, 404);
    for (const target of ['/%2e%2e/package.json', '/index.html?fake=1', '/js\\app.mjs']) assert.equal((await request(port, target)).status, 400);
  } finally { await close(server); }
}));
test('occupied port falls back without stopping existing listener', () => fixture(async root => {
  const owner = http.createServer((request, response) => response.end('FAKE_EXISTING_SERVICE'));
  await new Promise(resolve => owner.listen(0, '127.0.0.1', resolve));
  const originalPort = owner.address().port;
  let preview;
  try {
    preview = await createPreview({ root: path.join(root, 'public'), port: originalPort });
    assert.equal(preview.fallback, true); assert.notEqual(preview.port, originalPort);
    assert.equal((await request(originalPort, '/')).body, 'FAKE_EXISTING_SERVICE');
    assert.equal((await request(preview.port, '/')).status, 200);
  } finally { if (preview) await close(preview.server); await close(owner); }
}));
test('build copies exact bytes; unknown stale output fails before any write', () => fixture(async root => {
  assert.equal(await build(root), PUBLIC_FILES.length);
  for (const file of PUBLIC_FILES) assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, 'public', file)));
  await writeFile(path.join(root, 'dist', 'unknown.txt'), 'FAKE_SENTINEL');
  await writeFile(path.join(root, 'public', 'index.html'), 'FAKE_CHANGED');
  await assert.rejects(build(root), /UNKNOWN_FILE/);
  assert.equal(await readFile(path.join(root, 'dist', 'index.html'), 'utf8'), 'FAKE_OFFLINE_index.html');
  assert.equal(await readFile(path.join(root, 'dist', 'unknown.txt'), 'utf8'), 'FAKE_SENTINEL');
}));
test('hardlinked dist/source files are refused; external fake sentinel stays intact', () => fixture(async root => {
  const sentinel = path.join(root, 'sentinel.txt');
  await writeFile(sentinel, 'FAKE_EXTERNAL_SENTINEL');
  await mkdir(path.join(root, 'dist'));
  await link(sentinel, path.join(root, 'dist', 'index.html'));
  await assert.rejects(build(root), /UNSAFE_FILE/);
  assert.equal(await readFile(sentinel, 'utf8'), 'FAKE_EXTERNAL_SENTINEL');
  await rm(path.join(root, 'public', 'index.html'));
  await link(sentinel, path.join(root, 'public', 'index.html'));
  await assert.rejects(validateTree(path.join(root, 'public')), /UNSAFE_FILE/);
}));
test('junction dist root and public nested directory never follow external target', () => fixture(async root => {
  const sentinel = path.join(root, 'external');
  await mkdir(sentinel); await writeFile(path.join(sentinel, 'index.html'), 'FAKE_EXTERNAL_SENTINEL');
  await symlink(sentinel, path.join(root, 'dist'), 'junction');
  await assert.rejects(build(root), /UNSAFE_DIRECTORY|DIRECTORY_REDIRECT/);
  assert.equal(await readFile(path.join(sentinel, 'index.html'), 'utf8'), 'FAKE_EXTERNAL_SENTINEL');
  await rm(path.join(root, 'public', 'styles'), { recursive: true });
  await symlink(sentinel, path.join(root, 'public', 'styles'), 'junction');
  await assert.rejects(validateTree(path.join(root, 'public')), /UNSAFE_LINK/);
}));
