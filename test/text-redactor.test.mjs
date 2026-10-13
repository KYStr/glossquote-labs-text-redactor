import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText } from '../public/js/core/text-redactor.mjs';

const redact = (source, rules) => redactText({ source, rules });
const fail = (result, code, ruleIndex = null) => {
  assert.deepEqual(result, { ok: false, code, ruleIndex });
  assert.equal(Object.hasOwn(result, 'output'), false);
};
function success(source, rules, expected, expectedCounts) {
  const result = redact(source, rules);
  assert.deepEqual(result, { ok: true, output: expected,
    totalMatches: expectedCounts.reduce((sum, value) => sum + value, 0),
    perRule: expectedCounts.map((matchCount, index) => ({ ruleIndex: index + 1, matchCount })),
    sourceCodePointCount: Array.from(source).length, outputCodeUnitLength: expected.length });
  return result;
}

const literals = [
  ['A01 email', 'Alice email: a@example.test', ['a@example.test'], 'Alice email: [REDACTED]', [1]],
  ['A02 overlapping targets', 'Anna Ann', ['Ann', 'Anna'], '[REDACTED] [REDACTED]', [1, 1]],
  ['A03 longer target wins', 'AB', ['A', 'AB'], '[REDACTED]', [0, 1]],
  ['A04 repeated match', 'xAxA', ['A'], 'x[REDACTED]x[REDACTED]', [2]],
  ['A05 left-to-right non-overlap', 'ababa', ['aba'], '[REDACTED]ba', [1]],
  ['A06 replacement target itself', '[REDACTED]', ['[REDACTED]'], '[REDACTED]', [1]],
  ['A07 replacement is not rescanned', 'x[REDACTED]', ['x'], '[REDACTED][REDACTED]', [1]],
  ['A08 deterministic original order', 'Anna', ['Anna', 'Ann'], '[REDACTED]', [1, 0]],
  ['A09 case sensitive', 'ann', ['Ann'], 'ann', [0]],
  ['A10 trailing target space preserved', 'A A', ['A '], '[REDACTED]A', [1]],
  ['A12 whitespace target accepted', 'a b', [' '], 'a[REDACTED]b', [1]],
  ['A22 CRLF emoji CJK preservation', 'a\r\n😀漢字\r尾\n', ['漢'], 'a\r\n😀[REDACTED]字\r尾\n', [1]],
  ['A23 regex syntax is literal', 'x.*+?[]y', ['.*+?[]'], 'x[REDACTED]y', [1]],
  ['A24 no Unicode normalization', 'é e\u0301', ['é'], '[REDACTED] e\u0301', [1]],
  ['A26 zero match source intact', 'unlisted@example.test', ['listed@example.test '], 'unlisted@example.test', [0]],
  ['A28 fixed replacement', 'A', ['A'], '[REDACTED]', [1]],
  ['A29 zero per-rule count shown', 'AAAAAAAAAA', ['A', 'B'], '[REDACTED]'.repeat(10), [10, 0]],
  ['A30 script and textarea markup are text', '<script>fake()</script></textarea>', ['fake'], '<script>[REDACTED]()</script></textarea>', [1]],
  ['supplementary point not split', '😀😎😀', ['😀', '😀😎'], '[REDACTED][REDACTED]', [1, 1]]
];
for (const [name, source, rules, output, counts] of literals) test(name, () => success(source, rules, output, counts));

test('A11 empty target and A25 no rules differ', () => {
  fail(redact('abc', ['']), 'TARGET_EMPTY', 1);
  fail(redact('abc', []), 'NO_RULES');
});
test('A13 duplicate rejects whole batch', () => fail(redact('AB', ['A', 'B', 'A']), 'DUPLICATE_TARGET', 3));
test('A14 exact rule count limits', () => {
  const rules = Array.from({ length: 50 }, (_, index) => `target-${index}`);
  assert.equal(redact('fake source', rules).ok, true);
  fail(redact('fake source', [...rules, '51']), 'TOO_MANY_RULES');
  fail(redact('fake', new Array(2 ** 32 - 1)), 'TOO_MANY_RULES');
});
test('A15 exact target raw UTF-16 limit', () => {
  success('😀'.repeat(100), ['😀'.repeat(100)], '[REDACTED]', [1]);
  fail(redact('fake', ['😀'.repeat(100) + 'x']), 'TARGET_TOO_LONG', 1);
});
test('A16/A17 exact source raw UTF-16 limits', () => {
  assert.equal(redact('😀'.repeat(50000), ['x']).ok, true);
  fail(redact('😀'.repeat(50000) + 'x', ['x']), 'SOURCE_TOO_LONG');
});
test('A18/A19 lone high and low surrogates', () => {
  for (const bad of ['\ud800', '\udfff', 'x\ud800x', '\ud800\ud800\udc00']) {
    fail(redact(bad, ['A']), 'INVALID_UNICODE');
    fail(redact('fake', [bad]), 'INVALID_UNICODE', 1);
  }
});
test('A20/A21 every C0/C1 target control, source controls accepted', () => {
  for (const unit of [...Array.from({ length: 32 }, (_, i) => i), ...Array.from({ length: 33 }, (_, i) => i + 127)]) {
    fail(redact('fake', ['x' + String.fromCharCode(unit)]), 'TARGET_CONTROL_CHARACTER', 1);
  }
  success('A\u0000\u0085', ['A'], '[REDACTED]\u0000\u0085', [1]);
});
test('A27/A35 maximum count and million-unit output', () => {
  const result = success('A'.repeat(100000), ['A'], '[REDACTED]'.repeat(100000), [100000]);
  assert.equal(result.outputCodeUnitLength, 1000000);
});
test('A34 measured trie nodes and edge checks for maximum fixtures', () => {
  function measured(source, rules) {
    const originalGet = Map.prototype.get;
    const originalSet = Map.prototype.set;
    let getCalls = 0;
    let newEdges = 0;
    let result;
    try {
      Map.prototype.get = function(key) { getCalls++; return originalGet.call(this, key); };
      Map.prototype.set = function(key, value) { newEdges++; return originalSet.call(this, key, value); };
      result = redact(source, rules);
    } finally { Map.prototype.get = originalGet; Map.prototype.set = originalSet; }
    const targetPoints = rules.reduce((sum, target) => sum + Array.from(target).length, 0);
    return { result, nodes: newEdges + 1, edgeChecks: getCalls - targetPoints };
  }
  const disjoint = Array.from({ length: 50 }, (_, i) => String.fromCharCode(0x1000 + i).repeat(200));
  const maximumNodes = measured('A'.repeat(100000), disjoint);
  assert.equal(maximumNodes.result.ok, true);
  assert.equal(maximumNodes.nodes, 10001);
  assert.equal(maximumNodes.edgeChecks, 100000);
  const common = Array.from({ length: 50 }, (_, i) => 'A'.repeat(199) + String.fromCharCode(0x1000 + i));
  const worst = measured('A'.repeat(100000), common);
  assert.equal(worst.result.totalMatches, 0);
  assert.equal(worst.nodes, 250);
  assert.equal(worst.edgeChecks, 19980100);
  assert.ok(worst.edgeChecks <= 20000000);
});
test('A36 request descriptors, prototypes, symbols; getters never run', () => {
  let getters = 0;
  const accessor = { rules: ['A'] };
  Object.defineProperty(accessor, 'source', { enumerable: true, get() { getters++; return 'A'; } });
  const hidden = { source: 'A', rules: ['A'] };
  Object.defineProperty(hidden, 'hidden', { value: 'fake', enumerable: false });
  const hiddenSource = { rules: ['A'] };
  Object.defineProperty(hiddenSource, 'source', { value: 'A', enumerable: false });
  for (const input of [null, [], 'A', new Date(0), Object.create({ source: 'A', rules: ['A'] }),
    { source: 'A' }, { source: 'A', rules: ['A'], extra: 1 },
    { source: 'A', rules: ['A'], [Symbol('fake')]: 1 }, accessor, hidden, hiddenSource]) {
    fail(redactText(input), 'INVALID_REQUEST');
  }
  assert.equal(getters, 0);
  const plainNull = Object.assign(Object.create(null), { source: 'A', rules: ['A'] });
  assert.equal(redactText(plainNull).ok, true);
  const frozen = Object.freeze(['A']);
  assert.equal(redactText(Object.freeze({ source: 'A', rules: frozen })).ok, true);
});
test('A36 rules dense canonical enumerable data indices only', () => {
  let getters = 0;
  const accessor = ['A'];
  Object.defineProperty(accessor, '0', { enumerable: true, get() { getters++; return 'A'; } });
  const hidden = ['A'];
  Object.defineProperty(hidden, '0', { value: 'A', enumerable: false });
  const extra = Object.assign(['A'], { extra: 'fake' });
  const noncanonical = Object.assign(['A'], { '01': 'B' });
  const symbol = ['A']; symbol[Symbol('fake')] = 'B';
  for (const rules of [undefined, {}, ['A', , 'B'], new Array(1), accessor, hidden, extra, noncanonical, symbol]) {
    fail(redact('A', rules), 'INVALID_RULES');
  }
  assert.equal(getters, 0);
  fail(redact('A', [42]), 'INVALID_RULES', 1);
});
test('validation error priority and no partial counts', () => {
  fail(redactText({ source: 4, rules: [] }), 'INVALID_SOURCE');
  fail(redact('A'.repeat(100001) + '\ud800', []), 'SOURCE_TOO_LONG');
  fail(redact('', new Array(51)), 'SOURCE_EMPTY');
  fail(redact('A', ['\ud800'.repeat(201)]), 'TARGET_TOO_LONG', 1);
  fail(redact('A', ['A', '']), 'TARGET_EMPTY', 2);
  const bad = ['A']; Object.defineProperty(bad, 'extra', { get() { throw new Error('getter should not run'); } });
  fail(redact('A', bad), 'INVALID_RULES');
});
