import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, validateTree, assertDirectory, safeFile, requireNode24 } from './validation.mjs';
import { buildProduction } from './release.mjs';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function build(root = toolRoot, { production = false } = {}) {
  requireNode24();
  if (production) return buildProduction(root);
  await assertDirectory(root);
  const source = path.join(root, 'public');
  const destination = path.join(root, 'dist');
  await validateTree(source);
  // Validate all existing output before writing anything. Unknown stale files and links stop the build.
  try { await lstat(destination); await validateTree(destination, { complete: false }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const contents = await Promise.all(PUBLIC_FILES.map(async file => [file, await readFile(await safeFile(source, file))]));
  await mkdir(destination, { recursive: true });
  await assertDirectory(destination);
  for (const [relative, data] of contents) {
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await assertDirectory(path.dirname(target));
    await writeFile(target, data);
  }
  await validateTree(destination);
  return PUBLIC_FILES.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== '--production')) throw new Error('UNKNOWN_BUILD_MODE');
    process.stdout.write(`Built ${await build(toolRoot, { production: args[0] === '--production' })} allowlisted ${args.length ? 'production' : 'preview'} static files.\n`);
  }
  catch { process.stderr.write('BUILD_REJECTED_UNSAFE_OR_INVALID_TREE\n'); process.exitCode = 1; }
}
