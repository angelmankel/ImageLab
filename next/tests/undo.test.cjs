const { test } = require('node:test');
const assert = require('node:assert/strict');
const U = require('./_load.cjs')('src/app/undoLogic.ts');

const act = (label, log, mergeKey) => ({ label, mergeKey, undo: () => log.push(`undo ${label}`), redo: () => log.push(`redo ${label}`) });

test('push → undo → redo moves the entry between past and future', () => {
  const log = [];
  let s = U.pushEntry(U.emptyStack(), act('A', log), 0);
  s = U.pushEntry(s, act('B', log), 5000);
  let r = U.popUndo(s); r.entry.undo(); s = r.stack;
  assert.deepEqual(s.past.map((e) => e.label), ['A']);
  assert.deepEqual(s.future.map((e) => e.label), ['B']);
  r = U.popRedo(s); r.entry.redo(); s = r.stack;
  assert.deepEqual(s.past.map((e) => e.label), ['A', 'B']);
  assert.deepEqual(log, ['undo B', 'redo B']);
});

test('a new push clears the redo side', () => {
  let s = U.pushEntry(U.emptyStack(), act('A', []), 0);
  s = U.popUndo(s).stack;
  s = U.pushEntry(s, act('C', []), 10);
  assert.equal(s.future.length, 0);
  assert.deepEqual(s.past.map((e) => e.label), ['C']);
});

test('same mergeKey within the window = one entry: first undo, newest redo', () => {
  const log = [];
  const first = { label: 'Steps', mergeKey: 'steps', undo: () => log.push('undo1'), redo: () => log.push('redo1') };
  const second = { label: 'Steps', mergeKey: 'steps', undo: () => log.push('undo2'), redo: () => log.push('redo2') };
  let s = U.pushEntry(U.emptyStack(), first, 0);
  s = U.pushEntry(s, second, 500);
  assert.equal(s.past.length, 1);
  s.past[0].undo(); s.past[0].redo();
  assert.deepEqual(log, ['undo1', 'redo2']);
  s = U.pushEntry(s, second, 500 + U.MERGE_MS + 1);
  assert.equal(s.past.length, 2);
});

test('nothing to undo / redo → null entry, stack unchanged', () => {
  const s = U.emptyStack();
  assert.equal(U.popUndo(s).entry, null);
  assert.equal(U.popRedo(s).entry, null);
});

test('a redone entry never merges with the next push', () => {
  let s = U.pushEntry(U.emptyStack(), act('A', [], 'k'), 0);
  s = U.popUndo(s).stack; s = U.popRedo(s).stack;
  s = U.pushEntry(s, act('A', [], 'k'), 100);
  assert.equal(s.past.length, 2);
});

test('keeps at most LIMIT entries', () => {
  let s = U.emptyStack();
  for (let i = 0; i < U.LIMIT + 5; i++) s = U.pushEntry(s, act(`x${i}`, []), i * 10000);
  assert.equal(s.past.length, U.LIMIT);
  assert.equal(s.past[0].label, 'x5');
});
