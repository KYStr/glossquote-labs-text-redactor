import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

export const PUBLIC_FILES = Object.freeze([
  'index.html', 'en/index.html', 'styles/app.css', 'js/app.mjs', 'js/i18n.mjs',
  'js/state.mjs', 'js/core/text-redactor.mjs', 'robots.txt'
]);

export function requireNode24() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('NODE_24_REQUIRED');
}

export async function assertDirectory(directory) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_DIRECTORY');
  const resolved = await realpath(directory);
  if (path.resolve(resolved).toLowerCase() !== path.resolve(directory).toLowerCase()) {
    throw new Error('DIRECTORY_REDIRECT');
  }
}

export async function safeFile(root, relative, files = PUBLIC_FILES) {
  if (!files.includes(relative)) throw new Error('FILE_NOT_ALLOWLISTED');
  await assertDirectory(root);
  let current = root;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('UNSAFE_LINK');
    if (index < parts.length - 1) await assertDirectory(current);
    else if (!stat.isFile() || stat.nlink !== 1) throw new Error('UNSAFE_FILE');
  }
  return current;
}

export async function validateTree(root, { complete = true, files = PUBLIC_FILES } = {}) {
  await assertDirectory(root);
  const found = [];
  const allowedDirectories = new Set(files.flatMap(file => {
    const parts = file.split('/');
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
  }));
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      const absolute = path.join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error('UNSAFE_LINK');
      if (stat.isDirectory()) {
        if (!allowedDirectories.has(relative)) throw new Error('UNKNOWN_DIRECTORY');
        await assertDirectory(absolute);
        await walk(absolute, relative + '/');
      } else {
        if (!files.includes(relative)) throw new Error('UNKNOWN_FILE');
        await safeFile(root, relative, files);
        found.push(relative);
      }
    }
  }
  await walk(root);
  if (complete && (found.length !== files.length || files.some(file => !found.includes(file)))) {
    throw new Error('MISSING_PUBLIC_FILE');
  }
  return found.sort();
}
