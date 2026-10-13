import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, editSource, editRule, addRule, removeRule, processText, clearState,
  beginCopy, finishCopy, disposeState, isCurrentCopy } from '../public/js/state.mjs';
import { messages } from '../public/js/i18n.mjs';
import { page } from '../scripts/pages.mjs';

function processed() {
  const state = createState();
  editSource(state, 'Anna Ann');
  editRule(state, 0, 'Ann');
  addRule(state);
  editRule(state, 1, 'Anna');
  assert.equal(state.output, null);
  processText(state);
  return state;
}
test('A31 every draft mutation immediately invalidates result and counts', () => {
  for (const change of [state => editSource(state, 'Anna Ann!'), state => editRule(state, 0, 'A'),
    state => addRule(state), state => removeRule(state, 0)]) {
    const state = processed();
    const revision = state.revision;
    assert.equal(change(state), true);
    assert.equal(state.revision, revision + 1);
    assert.equal(state.output, null);
    assert.equal(state.matchCounts, null);
    assert.equal(state.totalMatches, null);
    assert.equal(beginCopy(state), null);
    assert.equal(state.notice, 'changed');
  }
});
test('A32 clear cancel preserves every field and result; A33 clear accept resets', () => {
  const state = processed();
  const before = structuredClone(state);
  assert.equal(clearState(state, false), false);
  assert.deepEqual(state, before);
  assert.equal(clearState(state, true), true);
  assert.equal(state.source, '');
  assert.deepEqual(state.ruleDrafts, ['']);
  assert.equal(state.output, null);
  assert.equal(state.matchCounts, null);
});
test('empty draft is retained; deleting all rules produces NO_RULES', () => {
  const state = createState();
  editSource(state, 'fake');
  assert.deepEqual(processText(state), { ok: false, code: 'TARGET_EMPTY', ruleIndex: 1 });
  removeRule(state, 0);
  assert.deepEqual(processText(state), { ok: false, code: 'NO_RULES', ruleIndex: null });
  addRule(state);
  editRule(state, 0, ' ');
  assert.equal(processText(state).ok, true);
});
test('complete raw over-limit drafts remain visible and invalid before submission', () => {
  const state = processed();
  editSource(state, 'A'.repeat(100001));
  assert.equal(state.source.length, 100001);
  assert.equal(state.fieldErrors.source, 'SOURCE_TOO_LONG');
  editRule(state, 0, 'B'.repeat(201));
  assert.equal(state.ruleDrafts[0].length, 201);
  assert.equal(state.fieldErrors[1], 'TARGET_TOO_LONG');
  assert.equal(processText(state).code, 'SOURCE_TOO_LONG');
  assert.equal(state.output, null);
});
test('clipboard single-flight locks all editing, process, clear and captures only output', () => {
  const state = processed();
  const ticket = beginCopy(state);
  assert.equal(ticket.output, '[REDACTED] [REDACTED]');
  assert.equal(beginCopy(state), null);
  const before = structuredClone(state);
  assert.equal(editSource(state, 'B'), false);
  assert.equal(editRule(state, 0, 'B'), false);
  assert.equal(addRule(state), false);
  assert.equal(removeRule(state, 0), false);
  assert.equal(clearState(state, true), false);
  assert.equal(processText(state), null);
  assert.deepEqual(state, before);
  assert.equal(finishCopy(state, ticket, 'manual'), true);
  assert.equal(state.copy.busy, false);
  assert.equal(state.copy.status, 'manual');
});
test('clipboard revision/requestId/pagehide guards ignore stale completion', () => {
  const state = processed();
  const ticket = beginCopy(state);
  assert.equal(isCurrentCopy(state, { ...ticket, requestId: ticket.requestId - 1 }), false);
  assert.equal(finishCopy(state, { ...ticket, revision: ticket.revision - 1 }, 'success'), false);
  disposeState(state);
  const disposed = structuredClone(state);
  assert.equal(finishCopy(state, ticket, 'success'), false);
  assert.deepEqual(state, disposed);
  assert.equal(state.source, '');
  assert.deepEqual(state.ruleDrafts, []);
  assert.equal(state.output, null);
});
test('zero-match output remains exportable while warning is visible in both locales', () => {
  const state = createState();
  editSource(state, 'unlisted@example.test'); editRule(state, 0, 'elsewhere@example.test');
  processText(state);
  assert.equal(state.notice, 'zero');
  assert.equal(beginCopy(state).output, 'unlisted@example.test');
  for (const locale of ['zh-Hant', 'en']) {
    assert.ok(page(locale).includes(messages[locale].warning));
    assert.ok(messages[locale].zero.length > 0);
  }
});
test('two static pages and translations are complete, preview-only, and safe', async () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages['zh-Hant']).sort());
  assert.deepEqual(Object.keys(messages.en.errors).sort(), Object.keys(messages['zh-Hant'].errors).sort());
  for (const [file, locale] of [['index.html', 'zh-Hant'], ['en/index.html', 'en']]) {
    const html = await readFile(new URL('../public/' + file, import.meta.url), 'utf8');
    assert.equal(html, page(locale));
    assert.ok(html.includes('noindex, nofollow'));
    assert.ok(html.includes(messages[locale].warning));
    assert.equal(/maxlength=/i.test(html), false);
  }
  const app = await readFile(new URL('../public/js/app.mjs', import.meta.url), 'utf8');
  assert.equal(/innerHTML|outerHTML|eval\(|new Function|console\.|fetch\(|localStorage|indexedDB/.test(app), false);
  assert.ok(app.includes('setTimeout(() => revoke(url), 60000)'));
  assert.ok(app.includes("anchor.download = 'glossquote-redacted.txt'"));
  assert.ok(app.includes('new TextEncoder().encode(state.output)'));
  assert.ok(app.includes('output.select()'));
  const bytes = new TextEncoder().encode('[REDACTED]\r\n😀尾');
  assert.deepEqual(Array.from(bytes.subarray(0, 3)), [91, 82, 69]);
  assert.equal(bytes.at(-1), 0xbe);
  // This tests byte encoding mechanics only, not native browser clipboard/download.
});
