import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, validateTree, requireNode24 } from './validation.mjs';
import { page } from './pages.mjs';
import { messages } from '../public/js/i18n.mjs';
import { checkProduction } from './release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function check(directory = root, { production = false } = {}) {
  requireNode24();
  await validateTree(path.join(directory, 'public'));
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (!pkg.private || pkg.type !== 'module' || pkg.dependencies || pkg.devDependencies || pkg.optionalDependencies) {
    throw new Error('PACKAGE_CONTRACT');
  }
  for (const [file, locale] of [['index.html', 'zh-Hant'], ['en/index.html', 'en']]) {
    const html = await readFile(path.join(directory, 'public', file), 'utf8');
    if (html !== page(locale)) throw new Error('STATIC_TRANSLATION_DRIFT');
    if (!html.includes('noindex, nofollow') || /canonical|hreflang|application\/ld\+json|maxlength=/i.test(html)) {
      throw new Error('PREVIEW_OR_RAW_DRAFT_CONTRACT');
    }
  }
  if (JSON.stringify(Object.keys(messages.en).sort()) !== JSON.stringify(Object.keys(messages['zh-Hant']).sort()) ||
      JSON.stringify(Object.keys(messages.en.errors).sort()) !== JSON.stringify(Object.keys(messages['zh-Hant'].errors).sort())) {
    throw new Error('TRANSLATION_KEYS');
  }
  for (const file of PUBLIC_FILES) {
    const source = await readFile(path.join(directory, 'public', file), 'utf8');
    if (file.endsWith('.mjs')) {
      if (/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|sendBeacon|serviceWorker)\b|document\.cookie|console\.|location\.(?:search|hash)|\bnew\s+RegExp/.test(source)) {
        throw new Error('PROHIBITED_BROWSER_SINK');
      }
      if (/\bimport\s*(?:\(|[^;]*?from\s*['"]https?:)/.test(source)) throw new Error('DYNAMIC_OR_REMOTE_IMPORT');
      const syntax = spawnSync(process.execPath, ['--check', path.join(directory, 'public', file)], { encoding: 'utf8' });
      if (syntax.status !== 0) throw new Error('JS_SYNTAX');
    }
    if (file.endsWith('.css') && /@import|url\s*\(/i.test(source)) throw new Error('REMOTE_OR_UNREVIEWED_CSS_ASSET');
  }
  if ((await readFile(path.join(directory, 'public/robots.txt'), 'utf8')).trim() !== 'User-agent: *\nDisallow: /') {
    throw new Error('PREVIEW_ROBOTS');
  }
  if (production) return checkProduction(directory);
  return { status: 'PASS', publicFiles: PUBLIC_FILES.length, runtimeDependencies: 0, note: 'Finite static check; not a Network/Storage audit.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== '--production')) throw new Error('UNKNOWN_CHECK_MODE');
    process.stdout.write(JSON.stringify(await check(root, {production:args[0] === '--production'})) + '\n');
  }
  catch { process.stderr.write('CHECK_FAILED\n'); process.exitCode = 1; }
}
