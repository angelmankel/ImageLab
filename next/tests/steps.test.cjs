const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/app/stepsLogic.ts');

const steps = [
  { id: 'a', kind: 'image', name: 'A', edited: false, chained: false },
  { id: 'b', kind: 'upscale', name: 'B', edited: false, chained: true },
  { id: 'c', kind: 'video', name: 'C', edited: false, chained: true },
];

test('titles and neighbours', () => {
  assert.equal(L.stepTitle(steps, 'a'), '1 · Image');
  assert.equal(L.stepTitle(steps, 'c'), '3 · Video');
  assert.equal(L.stepTitle(steps, 'zz'), '');
  assert.equal(L.nextStepId(steps, 'a'), 'b');
  assert.equal(L.nextStepId(steps, 'c'), null);
  assert.equal(L.prevStepId(steps, 'a'), null);
  assert.equal(L.prevStepId(steps, 'b'), 'a');
});

test('append chains to the previous step; the first does not', () => {
  const one = L.appendStep([], { id: 'x', kind: 'image', name: 'X', edited: false });
  assert.equal(one[0].chained, false);
  const two = L.appendStep(one, { id: 'y', kind: 'upscale', name: 'Y', edited: false });
  assert.equal(two[1].chained, true);
  assert.equal(L.appendStep(one, { id: 'z', kind: 'video', name: 'Z', edited: false, chained: false })[1].chained, false);
});

test('remove keeps step 1 and moves the active step', () => {
  assert.deepEqual(L.removeStepFrom(steps, 'a', 'a').steps.map((s) => s.id), ['a', 'b', 'c']);
  const r = L.removeStepFrom(steps, 'c', 'c');
  assert.deepEqual(r.steps.map((s) => s.id), ['a', 'b']);
  assert.equal(r.activeId, 'b');
  assert.equal(L.removeStepFrom(steps, 'b', 'c').activeId, 'c');
});

test('input mode: Off · Auto · Pick on the step, old saves read as Auto', () => {
  const old = { id: 'b', kind: 'upscale', name: 'B', edited: false, chained: true };
  assert.equal(L.chainModeOf(old), 'auto');
  assert.equal(L.chainModeOf({ ...old, chained: false }), 'off');
  assert.equal(L.chainModeOf({ ...old, input: { url: 'u', name: 'n' } }), 'off');
  const pick = { key: 'k', url: 'u/k', name: 'k.png' };
  const picked = L.withChainMode({ ...old, input: { url: 'u', name: 'n' } }, 'pick', pick);
  assert.equal(L.chainModeOf(picked), 'pick');
  assert.equal(picked.input, null);
  assert.deepEqual(picked.chainPick, pick);
  // Off keeps the pick so Pick comes back to it; Auto keeps it too (only the mode changes).
  const off = L.withChainMode(picked, 'off');
  assert.equal(L.chainModeOf(off), 'off');
  assert.deepEqual(off.chainPick, pick);
  assert.equal(L.chainModeOf(L.withChainMode(off, 'pick')), 'pick');
  assert.deepEqual(L.withChainMode(off, 'pick').chainPick, pick);
  assert.equal(L.chainModeOf(L.withChainMode(picked, 'auto')), 'auto');
  assert.equal(L.withChainMode(picked, 'pick', null).chainPick, null);
});
