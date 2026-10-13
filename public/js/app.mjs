import { messages } from './i18n.mjs';
import { createState, editSource, editRule, addRule, removeRule, processText, clearState,
  beginCopy, isCurrentCopy, finishCopy, disposeState } from './state.mjs';

const language = document.documentElement.lang === 'en' ? 'en' : 'zh-Hant';
const t = messages[language];
const numbers = new Intl.NumberFormat(language);
const count = value => numbers.format(value);
const byId = id => document.getElementById(id);
const source = byId('source');
const rules = byId('rules');
const output = byId('output');
const copyButton = byId('copy');
const downloadButton = byId('download');
const clearButton = byId('clear');
const dialog = byId('clear-dialog');
let state = createState();
let activeCopy = null;
const objectURLs = new Map();

function errorText(code) { return code ? '⚠ ' + t.errors[code] : ''; }

function renderRules() {
  rules.replaceChildren();
  state.ruleDrafts.forEach((draft, index) => {
    const rule = document.createElement('div');
    rule.className = 'rule';
    const heading = document.createElement('div');
    heading.className = 'rule-heading';
    const label = document.createElement('label');
    label.htmlFor = `rule-${index + 1}`;
    label.textContent = t.ruleLabel(count(index + 1));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet';
    remove.textContent = t.remove(count(index + 1));
    remove.addEventListener('click', () => {
      if (!removeRule(state, index)) return;
      renderRules();
      render();
      (byId(`rule-${Math.min(index + 1, state.ruleDrafts.length)}`) ?? byId('add-rule')).focus();
    });
    heading.append(label, remove);
    const field = document.createElement('textarea');
    field.id = `rule-${index + 1}`;
    field.rows = 1;
    field.spellcheck = false;
    field.autocomplete = 'off';
    field.setAttribute('autocapitalize', 'off');
    field.setAttribute('aria-describedby', `rule-help rule-length-${index + 1} rule-error-${index + 1}`);
    field.value = draft;
    field.addEventListener('input', () => { editRule(state, index, field.value); render(); });
    const length = document.createElement('p');
    length.id = `rule-length-${index + 1}`;
    length.className = 'length';
    const error = document.createElement('p');
    error.id = `rule-error-${index + 1}`;
    error.className = 'error';
    error.hidden = true;
    rule.append(heading, field, length, error);
    rules.append(rule);
  });
}

function showError(element, code) {
  element.hidden = !code;
  element.textContent = errorText(code);
}

function render() {
  if (state.disposed) return;
  const busy = state.copy.busy;
  if (source.value !== state.source) source.value = state.source;
  source.disabled = busy;
  source.setAttribute('aria-invalid', String(Boolean(state.fieldErrors.source)));
  byId('source-length').textContent = t.length(count(state.source.length), count(100000));
  showError(byId('source-error'), state.fieldErrors.source);
  byId('rule-count').textContent = t.ruleCount(count(state.ruleDrafts.length));
  state.ruleDrafts.forEach((draft, index) => {
    const field = byId(`rule-${index + 1}`);
    if (field.value !== draft) field.value = draft;
    field.disabled = busy;
    field.setAttribute('aria-invalid', String(Boolean(state.fieldErrors[index + 1])));
    byId(`rule-length-${index + 1}`).textContent = t.length(count(draft.length), count(200));
    showError(byId(`rule-error-${index + 1}`), state.fieldErrors[index + 1]);
  });
  rules.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  showError(byId('rules-error'), state.fieldErrors.rules);
  byId('add-rule').disabled = busy || state.ruleDrafts.length >= 50;
  byId('process').disabled = busy;
  clearButton.disabled = busy;
  copyButton.disabled = busy || state.output === null;
  downloadButton.disabled = busy || state.output === null;
  copyButton.textContent = busy ? t.copying : t.copy;
  copyButton.setAttribute('aria-busy', String(busy));
  byId('result-content').hidden = state.output === null;
  output.value = state.output ?? '';
  const counts = byId('match-counts');
  counts.replaceChildren();
  counts.hidden = state.matchCounts === null;
  state.matchCounts?.forEach(({ ruleIndex, matchCount }) => {
    const item = document.createElement('li');
    item.textContent = t.match(count(ruleIndex), count(matchCount));
    counts.append(item);
  });
  const status = byId('status');
  status.dataset.state = state.notice;
  status.textContent = state.notice === 'processed' ? t.processed(count(state.totalMatches)) : t[state.notice];
  byId('copy-status').textContent = state.copy.status === 'success' ? t.copyDone : state.copy.status === 'manual' ? t.copyManual : '';
}

source.addEventListener('input', () => { editSource(state, source.value); render(); });
byId('add-rule').addEventListener('click', () => {
  if (!addRule(state)) return;
  renderRules();
  render();
  byId(`rule-${state.ruleDrafts.length}`).focus();
});
byId('redactor-form').addEventListener('submit', event => {
  event.preventDefault();
  const result = processText(state);
  render();
  if (result && !result.ok) {
    const target = result.ruleIndex === null ? (state.fieldErrors.source ? source : byId('add-rule')) : byId(`rule-${result.ruleIndex}`);
    target.focus();
  }
});

copyButton.addEventListener('click', async () => {
  const copyState = state;
  const ticket = beginCopy(copyState);
  if (!ticket) return;
  const restoreCopyFocus = document.activeElement === copyButton;
  activeCopy = ticket;
  render();
  const current = () => state === copyState && isCurrentCopy(copyState, ticket);
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('COPY_UNAVAILABLE');
    await navigator.clipboard.writeText(ticket.output);
    if (current()) {
      finishCopy(copyState, ticket, 'success');
      render();
      if (restoreCopyFocus && document.activeElement === document.body) copyButton.focus();
    }
  } catch {
    if (current()) {
      finishCopy(copyState, ticket, 'manual');
      render();
      output.focus();
      output.select();
    }
  } finally {
    if (current() && copyState.copy.busy) { finishCopy(copyState, ticket, 'manual'); render(); }
    ticket.output = '';
    if (activeCopy === ticket) activeCopy = null;
  }
});

function revoke(url) {
  clearTimeout(objectURLs.get(url));
  objectURLs.delete(url);
  URL.revokeObjectURL(url);
}

downloadButton.addEventListener('click', () => {
  if (state.disposed || state.copy.busy || state.output === null) return;
  let url;
  try {
    const bytes = new TextEncoder().encode(state.output);
    const blob = new Blob([bytes], { type: 'text/plain;charset=utf-8' });
    url = URL.createObjectURL(blob);
    objectURLs.set(url, setTimeout(() => revoke(url), 60000));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'glossquote-redacted.txt';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    byId('copy-status').textContent = t.downloaded;
  } catch {
    if (url) revoke(url);
    byId('copy-status').textContent = t.downloadError;
    output.focus();
    output.select();
  }
});

clearButton.addEventListener('click', () => {
  if (!state.disposed && !state.copy.busy) { dialog.returnValue = ''; dialog.showModal(); }
});
byId('cancel-clear').addEventListener('click', () => dialog.close('cancel'));
byId('confirm-clear').addEventListener('click', () => dialog.close('confirm'));
dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
dialog.addEventListener('close', () => {
  if (state.disposed) return;
  if (clearState(state, dialog.returnValue === 'confirm')) renderRules();
  render();
  clearButton.focus();
});

window.addEventListener('pagehide', () => {
  disposeState(state);
  if (activeCopy) activeCopy.output = '';
  for (const url of objectURLs.keys()) revoke(url);
  if (dialog.open) dialog.close('cancel');
  source.value = '';
  rules.querySelectorAll('textarea').forEach(field => { field.value = ''; });
  rules.replaceChildren();
  output.value = '';
  byId('match-counts').replaceChildren();
  byId('result-content').hidden = true;
  copyButton.disabled = true;
  downloadButton.disabled = true;
});
window.addEventListener('pageshow', () => {
  if (state.disposed) { state = createState(); renderRules(); render(); }
});

renderRules();
render();
