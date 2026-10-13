import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../public/js/i18n.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
export function page(language) {
  const t = messages[language];
  const en = language === 'en';
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="${t.description}">
  <title>${t.title}</title>
  <link rel="stylesheet" href="/styles/app.css">
  <script type="module" src="/js/app.mjs"></script>
</head>
<body>
  <header class="topbar">
    <nav aria-label="${en ? 'Site navigation' : '網站導覽'}">
      <a class="brand" href="https://glossquote.com/${en ? 'en/' : ''}index.html">Gloss Tools <span>by GlossQuote</span></a>
      <div class="navlinks"><a href="https://glossquote.com/${en ? 'en/' : ''}index.html">${t.home}</a><a href="${en ? '/index.html' : '/en/index.html'}" lang="${en ? 'zh-Hant' : 'en'}" aria-label="${t.languageName}">${t.language}</a></div>
    </nav>
  </header>
  <main id="main">
    <header class="page-heading"><h1>${t.heading}</h1><p>${t.intro}</p></header>
    <aside class="warning" aria-label="${en ? 'Redaction limits' : '遮蔽限制'}"><span aria-hidden="true">⚠</span><p>${t.warning}</p></aside>
    <noscript><p class="error">${t.noScript}</p></noscript>
    <form id="redactor-form" autocomplete="off" novalidate>
      <section class="source-section" aria-labelledby="source-label">
        <label id="source-label" class="section-label" for="source">${t.source}</label>
        <p class="help" id="source-help">${t.sourceHelp}</p>
        <textarea id="source" rows="7" placeholder="${t.sourcePlaceholder}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="source-help source-length source-error"></textarea>
        <p id="source-length" class="length">${t.length('0', '100,000')}</p>
        <p id="source-error" class="error" hidden></p>
      </section>
      <section class="targets-section" aria-labelledby="targets-heading">
        <div class="section-heading"><h2 id="targets-heading">${t.targets}</h2><span id="rule-count" class="length">${t.ruleCount('1')}</span></div>
        <p class="help" id="rule-help">${t.ruleHelp}</p>
        <p class="help">${t.replacement}</p>
        <div id="rules"></div>
        <p id="rules-error" class="error" hidden></p>
        <button type="button" id="add-rule" class="secondary">+ ${t.add}</button>
      </section>
      <div class="actionbar"><button type="submit" id="process" class="primary">${t.process}</button><button type="button" id="clear" class="quiet">${t.clear}</button></div>
    </form>
    <section class="result-section" aria-labelledby="result-heading">
      <h2 id="result-heading">${t.result}</h2>
      <p id="status" class="status" role="status" aria-live="polite" aria-atomic="true">${t.idle}</p>
      <ul id="match-counts" class="match-counts" hidden></ul>
      <div id="result-content" hidden>
        <label class="help" id="result-label" for="output">${t.resultHelp}</label>
        <textarea id="output" rows="8" readonly spellcheck="false" autocomplete="off" aria-describedby="result-warning" aria-labelledby="result-heading result-label"></textarea>
      </div>
      <div class="result-actions"><button type="button" id="copy" class="secondary" disabled>${t.copy}</button><button type="button" id="download" class="secondary" disabled>${t.download}</button></div>
      <p id="copy-status" class="help" role="status" aria-live="polite" aria-atomic="true"></p>
      <p class="result-warning" id="result-warning"><span aria-hidden="true">⚠ </span>${t.warning}</p>
    </section>
    <aside class="lifecycle"><p>${t.privacy}</p><p>${t.reload}</p></aside>
    <section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">${t.faq}</h2>
      <details><summary>${t.faqDetect}</summary><p>${t.faqDetectAnswer}</p></details>
      <details><summary>${t.faqSpaces}</summary><p>${t.faqSpacesAnswer}</p></details>
      <details><summary>${t.faqUpload}</summary><p>${t.faqUploadAnswer}</p></details>
    </section>
  </main>
  <footer>Gloss Tools by GlossQuote</footer>
  <dialog id="clear-dialog" aria-labelledby="clear-title" aria-describedby="clear-help">
    <h2 id="clear-title">${t.clearTitle}</h2><p id="clear-help">${t.clearHelp}</p>
    <div class="dialog-actions"><button type="button" id="cancel-clear" class="secondary" autofocus>${t.cancel}</button><button type="button" id="confirm-clear" class="danger">${t.confirm}</button></div>
  </dialog>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(path.join(root, 'en'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), page('zh-Hant'));
  await writeFile(path.join(root, 'en/index.html'), page('en'));
}
