const MAX_SOURCE = 100000;
const MAX_RULES = 50;
const MAX_TARGET = 200;
const REPLACEMENT = '[REDACTED]';

function failure(code, ruleIndex = null) {
  return { ok: false, code, ruleIndex };
}

function wellFormed(text) {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function dataDescriptor(descriptor, enumerable) {
  return descriptor !== undefined && Object.hasOwn(descriptor, 'value') &&
    descriptor.enumerable === enumerable && !Object.hasOwn(descriptor, 'get') &&
    !Object.hasOwn(descriptor, 'set');
}

function validateSource(source) {
  if (typeof source !== 'string') return { ok: false, code: 'INVALID_SOURCE' };
  if (source.length > MAX_SOURCE) return { ok: false, code: 'SOURCE_TOO_LONG' };
  if (!wellFormed(source)) return { ok: false, code: 'INVALID_UNICODE' };
  if (source.length === 0) return { ok: false, code: 'SOURCE_EMPTY' };
  return { ok: true, codePointLength: Array.from(source).length, utf16Length: source.length };
}

function validateRules(rules) {
  try {
    if (!Array.isArray(rules)) return failure('INVALID_RULES');
    const length = Object.getOwnPropertyDescriptor(rules, 'length');
    if (!dataDescriptor(length, false) || length.configurable !== false ||
        !Number.isSafeInteger(length.value) || length.value < 0) return failure('INVALID_RULES');
    // Check this before enumerating indices of a potentially huge sparse array.
    if (length.value > MAX_RULES) return failure('TOO_MANY_RULES');
    const keys = Reflect.ownKeys(rules);
    if (keys.length !== length.value + 1 || keys.some(key => typeof key !== 'string')) {
      return failure('INVALID_RULES');
    }
    const validatedRules = [];
    for (let i = 0; i < length.value; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(rules, String(i));
      if (!dataDescriptor(descriptor, true)) return failure('INVALID_RULES');
      validatedRules.push(descriptor.value);
    }
    if (length.value === 0) return failure('NO_RULES');
    const seen = new Set();
    for (let i = 0; i < validatedRules.length; i++) {
      const target = validatedRules[i];
      const index = i + 1;
      if (typeof target !== 'string') return failure('INVALID_RULES', index);
      if (target.length > MAX_TARGET) return failure('TARGET_TOO_LONG', index);
      if (target.length === 0) return failure('TARGET_EMPTY', index);
      if (!wellFormed(target)) return failure('INVALID_UNICODE', index);
      for (let j = 0; j < target.length; j++) {
        const unit = target.charCodeAt(j);
        if (unit <= 0x1f || (unit >= 0x7f && unit <= 0x9f)) {
          return failure('TARGET_CONTROL_CHARACTER', index);
        }
      }
      if (seen.has(target)) return failure('DUPLICATE_TARGET', index);
      seen.add(target);
    }
    return { ok: true, validatedRules };
  } catch {
    return failure('INVALID_RULES');
  }
}

function node() {
  return { edges: new Map(), terminal: null };
}

function buildTrie(rules) {
  const root = node();
  for (let index = 0; index < rules.length; index++) {
    let current = root;
    for (const point of rules[index]) {
      if (!current.edges.has(point)) current.edges.set(point, node());
      current = current.edges.get(point);
    }
    if (current.terminal === null || index < current.terminal) current.terminal = index;
  }
  return root;
}

// Only public core API. Descriptors are read before values; no input getter is invoked.
export function redactText(request) {
  let source;
  let rules;
  try {
    if (request === null || typeof request !== 'object') return failure('INVALID_REQUEST');
    const prototype = Object.getPrototypeOf(request);
    if (prototype !== Object.prototype && prototype !== null) return failure('INVALID_REQUEST');
    const keys = Reflect.ownKeys(request);
    if (keys.length !== 2 || !keys.includes('source') || !keys.includes('rules')) {
      return failure('INVALID_REQUEST');
    }
    const sourceDescriptor = Object.getOwnPropertyDescriptor(request, 'source');
    const rulesDescriptor = Object.getOwnPropertyDescriptor(request, 'rules');
    if (!dataDescriptor(sourceDescriptor, true) || !dataDescriptor(rulesDescriptor, true)) {
      return failure('INVALID_REQUEST');
    }
    source = sourceDescriptor.value;
    rules = rulesDescriptor.value;
  } catch {
    return failure('INVALID_REQUEST');
  }
  const checkedSource = validateSource(source);
  if (!checkedSource.ok) return failure(checkedSource.code);
  const checkedRules = validateRules(rules);
  if (!checkedRules.ok) return checkedRules;
  const trie = buildTrie(checkedRules.validatedRules);
  const points = Array.from(source);
  const outputParts = [];
  const counts = checkedRules.validatedRules.map(() => 0);
  let totalMatches = 0;
  for (let i = 0; i < points.length;) {
    let current = trie;
    let matchedIndex = null;
    let matchedLength = 0;
    // <= 200 edge checks per source code point; replacement text is never scanned.
    for (let j = i; j < points.length && j - i < MAX_TARGET; j++) {
      current = current.edges.get(points[j]);
      if (current === undefined) break;
      if (current.terminal !== null) {
        matchedIndex = current.terminal;
        matchedLength = j - i + 1;
      }
    }
    if (matchedIndex !== null) {
      outputParts.push(REPLACEMENT);
      counts[matchedIndex]++;
      totalMatches++;
      i += matchedLength;
    } else {
      outputParts.push(points[i]);
      i++;
    }
  }
  const output = outputParts.join('');
  return {
    ok: true,
    output,
    totalMatches,
    perRule: counts.map((matchCount, index) => ({ ruleIndex: index + 1, matchCount })),
    sourceCodePointCount: checkedSource.codePointLength,
    outputCodeUnitLength: output.length
  };
}
