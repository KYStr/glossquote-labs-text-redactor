import { readdir, readFile, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, validateTree, requireNode24 } from './validation.mjs';
import { PRODUCTION_FILES, checkProduction } from './release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function inventory(directory, prefix = '') {
  const records = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (name === 'dist' || name === 'dist-production' || name === 'node_modules' || name === '.git' || name === 'test/.tmp' || name === '.wrangler') continue;
    const absolute = path.join(directory, entry.name);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error('MANIFEST_LINK');
    if (stat.isDirectory()) records.push(...await inventory(absolute, name + '/'));
    else {
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('MANIFEST_UNSAFE_FILE');
      const bytes = await readFile(absolute);
      records.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  return records.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function group(files) { return { files, sha256: digest(JSON.stringify(files)) }; }
export async function manifest(directory = root, { production = false } = {}) {
  requireNode24();
  await validateTree(path.join(directory, 'public'));
  await validateTree(path.join(directory, 'dist'));
  const files = await inventory(directory);
  const runtime = files.filter(file => file.path.startsWith('public/'));
  const code = files.filter(file => file.path.startsWith('public/') || file.path.startsWith('scripts/') ||
    file.path.startsWith('test/') || file.path === 'package.json' || file.path === '.gitignore');
  const dist = [];
  for (const file of PUBLIC_FILES.slice().sort()) {
    const bytes = await readFile(path.join(directory, 'dist', file));
    const record = { path: 'dist/' + file, bytes: bytes.length, sha256: digest(bytes) };
    const source = runtime.find(item => item.path === 'public/' + file);
    if (source.sha256 !== record.sha256 || source.bytes !== record.bytes) throw new Error('DIST_SOURCE_MISMATCH');
    dist.push(record);
  }
  const result = { schemaVersion: 1, nodeVersion: process.version, status: 'PASS', source: group(files), code: group(code), runtime: group(runtime), dist: group(dist) };
  if (production) {
    await checkProduction(directory);
    const generated = [];
    for (const file of PRODUCTION_FILES.slice().sort()) {
      const bytes = await readFile(path.join(directory,'dist-production',file));
      generated.push({path:'dist-production/'+file,bytes:bytes.length,sha256:digest(bytes)});
    }
    result.production = group(generated);
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) throw new Error('EVIDENCE_OUTPUT_REQUIRED');
  if (process.argv.length > 4 || (process.argv[3] && process.argv[3] !== '--production')) throw new Error('UNKNOWN_MANIFEST_MODE');
  const result = await manifest(root, {production:process.argv[3] === '--production'});
  await writeFile(target, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ status: result.status, source: result.source.sha256, code: result.code.sha256,
    runtime: result.runtime.sha256, dist: result.dist.sha256, production: result.production?.sha256 }) + '\n');
}
