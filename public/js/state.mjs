import { redactText } from './core/text-redactor.mjs';

export function createState() {
  return {
    source: '', ruleDrafts: [''], revision: 0, output: null, matchCounts: null,
    totalMatches: null, fieldErrors: {}, copy: { busy: false, requestId: 0, revision: 0, status: 'idle' },
    notice: 'idle', disposed: false
  };
}

function editable(state) {
  return !state.disposed && !state.copy.busy;
}

function invalidate(state) {
  const hadResult = state.output !== null;
  state.revision++;
  state.output = null;
  state.matchCounts = null;
  state.totalMatches = null;
  state.fieldErrors = {};
  state.copy.requestId++;
  state.copy.status = 'idle';
  state.notice = hadResult || state.notice === 'changed' ? 'changed' : 'idle';
  // Always inspect the entire raw draft. Never truncate it to make validation pass.
  if (state.source.length > 100000) state.fieldErrors.source = 'SOURCE_TOO_LONG';
  state.ruleDrafts.forEach((target, index) => {
    if (target.length > 200) state.fieldErrors[index + 1] = 'TARGET_TOO_LONG';
  });
}

export function editSource(state, value) {
  if (!editable(state) || value === state.source) return false;
  state.source = value;
  invalidate(state);
  return true;
}

export function editRule(state, index, value) {
  if (!editable(state) || !Number.isInteger(index) || index < 0 || index >= state.ruleDrafts.length ||
      state.ruleDrafts[index] === value) return false;
  state.ruleDrafts[index] = value;
  invalidate(state);
  return true;
}

export function addRule(state) {
  if (!editable(state) || state.ruleDrafts.length >= 50) return false;
  state.ruleDrafts.push('');
  invalidate(state);
  return true;
}

export function removeRule(state, index) {
  if (!editable(state) || !Number.isInteger(index) || index < 0 || index >= state.ruleDrafts.length) return false;
  state.ruleDrafts.splice(index, 1);
  invalidate(state);
  return true;
}

export function processText(state) {
  if (!editable(state)) return null;
  const result = redactText({ source: state.source, rules: state.ruleDrafts });
  state.output = null;
  state.matchCounts = null;
  state.totalMatches = null;
  state.fieldErrors = {};
  state.copy.requestId++;
  state.copy.status = 'idle';
  if (result.ok) {
    state.output = result.output;
    state.matchCounts = result.perRule;
    state.totalMatches = result.totalMatches;
    state.notice = result.totalMatches === 0 ? 'zero' : 'processed';
  } else {
    state.fieldErrors[result.ruleIndex ?? (result.code.startsWith('SOURCE') ||
      result.code === 'INVALID_SOURCE' || result.code === 'INVALID_UNICODE' ? 'source' : 'rules')] = result.code;
    state.notice = 'error';
  }
  return result;
}

export function clearState(state, confirmed) {
  if (!confirmed || !editable(state)) return false;
  state.source = '';
  state.ruleDrafts = [''];
  invalidate(state);
  state.notice = 'cleared';
  return true;
}

export function beginCopy(state) {
  if (!editable(state) || state.output === null) return null;
  state.copy.requestId++;
  state.copy.revision = state.revision;
  state.copy.busy = true;
  state.copy.status = 'busy';
  return { requestId: state.copy.requestId, revision: state.revision, output: state.output };
}

export function isCurrentCopy(state, ticket) {
  return !state.disposed && ticket !== null && state.copy.requestId === ticket.requestId &&
    state.revision === ticket.revision && state.copy.revision === ticket.revision;
}

export function finishCopy(state, ticket, status) {
  if (!isCurrentCopy(state, ticket)) return false;
  state.copy.status = status;
  state.copy.busy = false;
  return true;
}

export function disposeState(state) {
  state.disposed = true;
  state.revision++;
  state.copy.requestId++;
  state.copy.busy = false;
  state.copy.status = 'idle';
  state.source = '';
  state.ruleDrafts = [];
  state.output = null;
  state.matchCounts = null;
  state.totalMatches = null;
  state.fieldErrors = {};
  state.notice = 'idle';
}
