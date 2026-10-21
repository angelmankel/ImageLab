// Item 8: reset to default (src/ui/resetLogic.ts): equal within a hair of the step; a reset sets
// the default and pushes an undo entry that puts the old value back.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const pushed = [];
const R = load('src/ui/resetLogic.ts', { '~/app/undo': { pushUndo: (e) => pushed.push(e), withoutUndo: (fn) => fn() } });

test('sameValue: numbers within step/1000, others strictly', () => {
  assert.equal(R.sameValue(7, 7.0000001, 0.5), true);
  assert.equal(R.sameValue(0.3, 0.1 + 0.2, 0.01), true);
  assert.equal(R.sameValue(7, 7.5, 0.5), false);
  assert.equal(R.sameValue('euler', 'euler'), true);
  assert.equal(R.sameValue('euler', 'dpmpp_2m'), false);
});

test('resetWithUndo: applies the default, undo restores, redo re-applies', () => {
  let v = 12;
  R.resetWithUndo('Steps', v, 25, (x) => { v = x; });
  assert.equal(v, 25);
  assert.equal(pushed.at(-1).label, 'Reset Steps');
  pushed.at(-1).undo(); assert.equal(v, 12);
  pushed.at(-1).redo(); assert.equal(v, 25);
});
