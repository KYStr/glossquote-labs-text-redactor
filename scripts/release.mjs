import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, assertDirectory, safeFile, validateTree, requireNode24 } from './validation.mjs';
import { messages } from '../public/js/i18n.mjs';

export const ORIGIN = 'https://redact.glossquote.com';
export const PRODUCTION_FILES = Object.freeze([...PUBLIC_FILES, 'sitemap.xml', '404.html', 'en/404.html', '_headers', '_redirects']);
export const M1_SHA256 = Object.freeze({
  'index.html': '0f313e735b6f6af7499b5198c34e7ebaa0ab19530fa3111505714af8ddae4ecd',
  'en/index.html': 'fe1cc2587a72f1173e415c486ba97dc131fc1bb3c2a496121b20a78eb7051d56',
  'robots.txt': '331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1',
  'styles/app.css': 'a5f3a7908809a1fc0425606df14a905274ca7710494f0888e4cf11cd4c8ca0bd',
  'js/app.mjs': 'df9fff650a3d1f26e8741b62646299ef613f104d4393e5d1ffcfc12f8b8c746d',
  'js/i18n.mjs': 'd48cb9684ad55e2d22fdc99badc35ff4350de80c7512b54baeeec79e17b69f07',
  'js/state.mjs': '11ee1bc1794139cf702488140c842d1e2b958979e9f59b5445f0ff53786b29f6',
  'js/core/text-redactor.mjs': '784936c6f3af63034c98d959585226d56f35a7e214ac2efcaa9aa3498456edce'
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function structuredData(locale) {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication',
    name: locale === 'en' ? 'Custom Text Redactor' : '自訂文字遮蔽',
    description: messages[locale].description, url: ORIGIN + (locale === 'en' ? '/en/index.html' : '/index.html'),
    inLanguage: locale, applicationCategory: 'UtilitiesApplication', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true });
}
export function productionPage(preview, locale) {
  const t = messages[locale];
  const en = locale === 'en';
  const canonical = ORIGIN + (en ? '/en/index.html' : '/index.html');
  const metadata = `<meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="zh-Hant" href="${ORIGIN}/index.html">
  <link rel="alternate" hreflang="en" href="${ORIGIN}/en/index.html">
  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/index.html">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Gloss Tools by GlossQuote">
  <meta property="og:title" content="${t.title}">
  <meta property="og:description" content="${t.description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${en ? 'en_US' : 'zh_TW'}">
  <meta property="og:locale:alternate" content="${en ? 'zh_TW' : 'en_US'}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${t.title}">
  <meta name="twitter:description" content="${t.description}">
  <script type="application/ld+json">${structuredData(locale)}</script>`;
  if (preview.split('<meta name="robots" content="noindex, nofollow">').length !== 2) throw new Error('PREVIEW_HEAD_DRIFT');
  return preview.replace('<meta name="robots" content="noindex, nofollow">', metadata);
}
export function notFoundPage(locale) {
  const en = locale === 'en';
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${en ? 'Page not found' : '找不到頁面'} | GlossQuote Tools</title><link rel="stylesheet" href="/styles/app.css"></head><body><main><h1>${en ? 'Page not found' : '找不到頁面'}</h1><p>${en ? 'This address does not have a page. Return to the text redactor.' : '這個網址沒有頁面。請返回自訂文字遮蔽工具。'}</p><p><a href="${en ? '/en/index.html' : '/index.html'}">${en ? 'Open the text redactor' : '返回自訂文字遮蔽'}</a></p><p><a href="https://glossquote.com/${en ? 'en/' : ''}index.html">${en ? 'All tools' : '工具首頁'}</a></p></main></body></html>
`;
}
export function productionHeaders() {
  const hashes = ['zh-Hant', 'en'].map(locale => "'sha256-" + createHash('sha256').update(structuredData(locale)).digest('base64') + "'").join(' ');
  return {
    'Content-Security-Policy': `default-src 'none'; script-src 'self' ${hashes}; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Strict-Transport-Security': 'max-age=31536000',
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store'
  };
}
export function headersFile() {
  return '/*\n' + Object.entries(productionHeaders()).map(([name,value]) => `  ${name}: ${value}\n`).join('') +
    '/js/*\n  Content-Type: text/javascript; charset=utf-8\n/styles/*\n  Content-Type: text/css; charset=utf-8\n/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n/robots.txt\n  Content-Type: text/plain; charset=utf-8\n/404.html\n  X-Robots-Tag: noindex, nofollow\n/en/404.html\n  X-Robots-Tag: noindex, nofollow\n';
}
export const REDIRECTS = '/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n';
export const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}/index.html</loc></url><url><loc>${ORIGIN}/en/index.html</loc></url></urlset>\n`;

export async function expectedProduction(directory = root) {
  requireNode24();
  await validateTree(path.join(directory, 'public'));
  const files = new Map();
  for (const name of PUBLIC_FILES) {
    const bytes = await readFile(await safeFile(path.join(directory, 'public'), name));
    if (sha256(bytes) !== M1_SHA256[name]) throw new Error('M1_ASSET_DRIFT');
    files.set(name, bytes);
  }
  for (const [file,locale] of [['index.html','zh-Hant'],['en/index.html','en']]) {
    files.set(file, Buffer.from(productionPage(files.get(file).toString('utf8'),locale)));
  }
  files.set('robots.txt', Buffer.from(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  files.set('sitemap.xml', Buffer.from(SITEMAP));
  files.set('404.html', Buffer.from(notFoundPage('zh-Hant')));
  files.set('en/404.html', Buffer.from(notFoundPage('en')));
  files.set('_headers', Buffer.from(headersFile()));
  files.set('_redirects', Buffer.from(REDIRECTS));
  return files;
}
export async function buildProduction(directory = root) {
  await assertDirectory(directory);
  const files = await expectedProduction(directory);
  const destination = path.join(directory, 'dist-production');
  try { await lstat(destination); await validateTree(destination, {complete:false,files:PRODUCTION_FILES}); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(destination, {recursive:true});
  await assertDirectory(destination);
  for (const [relative,bytes] of files) {
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), {recursive:true});
    await assertDirectory(path.dirname(target));
    await writeFile(target, bytes);
  }
  await validateTree(destination, {files:PRODUCTION_FILES});
  return files.size;
}
export async function checkProduction(directory = root) {
  const expected = await expectedProduction(directory);
  const destination = path.join(directory, 'dist-production');
  await validateTree(destination, {files:PRODUCTION_FILES});
  for (const [name,bytes] of expected) {
    if (!(await readFile(await safeFile(destination,name,PRODUCTION_FILES))).equals(bytes)) throw new Error('PRODUCTION_DRIFT');
  }
  const config = JSON.parse(await readFile(path.join(directory,'wrangler.jsonc'),'utf8'));
  if (config.name !== 'glossquote-text-redactor' || config.assets?.directory !== './dist-production' ||
    config.assets?.html_handling !== 'none' || config.assets?.not_found_handling !== '404-page' ||
    config.workers_dev !== false || config.preview_urls !== false || config.send_metrics !== false ||
    config.logpush !== false || config.observability?.enabled !== false || config.observability.logs?.enabled !== false ||
    config.observability.traces?.enabled !== false || config.main || config.account_id || config.vars || config.env ||
    JSON.stringify(config.routes) !== JSON.stringify([{pattern:'redact.glossquote.com',custom_domain:true}])) throw new Error('WRANGLER_RELEASE_CONTRACT');
  return {status:'PASS',files:PRODUCTION_FILES.length,origin:ORIGIN,M1AssetsUnchanged:true,hosting:'NOT_RUN'};
}
