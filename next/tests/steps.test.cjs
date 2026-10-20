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

// ── the step I/O standard (fix list 24) ──
const mk = (id, kind, extra = {}) => ({ id, kind, name: id, edited: false, chained: true, ...extra });

test('I/O table: Image makes its own picture, Refine / Upscale / Remove BG need one, Remove BG keeps alpha', () => {
  assert.equal(L.STEP_IO.image.needs, 'none');
  for (const k of ['refine', 'upscale', 'remove-bg']) assert.equal(L.STEP_IO[k].needs, 'image');
  assert.equal(L.STEP_IO['remove-bg'].alpha, true);
  assert.ok(!L.ADDABLE_KINDS.includes('image'));
});

test('newStep carries the kind defaults and an explicit input', () => {
  const r = L.newStep('r', 'refine');
  assert.equal(r.name, 'Refine');
  assert.equal(r.params.refine.iterations, 2);
  const u = L.newStep('u', 'upscale', undefined, { url: 'x', name: 'x.png' });
  assert.equal(u.params.upscale.factor, 2);
  assert.deepEqual(u.input, { url: 'x', name: 'x.png' });
});

test('insertStepAfter: lands right after, chains unless it brings a picture', () => {
  const base = [mk('a', 'image', { chained: false }), mk('b', 'upscale')];
  const one = L.insertStepAfter(base, 'a', L.newStep('n', 'refine'));
  assert.deepEqual(one.map((s) => s.id), ['a', 'n', 'b']);
  assert.equal(one[1].chained, true);
  const two = L.insertStepAfter(base, 'a', L.newStep('p', 'remove-bg', undefined, { url: 'u', name: 'u.png' }));
  assert.equal(two[1].chained, false);
  assert.deepEqual(L.insertStepAfter(base, 'zz', L.newStep('e', 'refine')).map((s) => s.id), ['a', 'b', 'e']);
});

test('moveStep keeps step 1 first and resets a pick whose step above changed', () => {
  const base = [mk('a', 'image', { chained: false }), mk('b', 'refine'), mk('c', 'upscale', { chainMode: 'pick', chainPick: { key: 'k', url: 'u', name: 'n' } })];
  const moved = L.moveStep(base, 'c', 1);
  assert.deepEqual(moved.map((s) => s.id), ['a', 'c', 'b']);
  assert.equal(moved[1].chainMode, 'auto');
  assert.deepEqual(L.moveStep(base, 'c', 0).map((s) => s.id), ['a', 'c', 'b']);
  assert.deepEqual(L.moveStep(base, 'a', 2).map((s) => s.id), ['a', 'b', 'c']);
  // A pick whose neighbour above did not change stays a pick.
  const kept = L.moveStep([...base, mk('d', 'video')], 'd', 1);
  assert.equal(kept.find((s) => s.id === 'c').chainMode, 'pick');
});

test('remove + restore put the chain back; an Off step stays Off', () => {
  const base = [mk('a', 'image', { chained: false }), mk('b', 'refine'), mk('c', 'video', { chained: false })];
  const r = L.removeStepFrom(base, 'b', 'b');
  assert.deepEqual(r.steps.map((s) => s.id), ['a', 'c']);
  assert.equal(r.activeId, 'c');
  assert.equal(r.steps[1].chained, false);
  assert.deepEqual(L.restoreStepAt(r.steps, base[1], 1).map((s) => s.id), ['a', 'b', 'c']);
});

test('clearing a picture: an image-needing step follows the step above again', () => {
  assert.equal(L.clearStepInput(mk('u', 'upscale', { chained: false, input: { url: 'u', name: 'n' } })).chained, true);
  assert.equal(L.clearStepInput(mk('v', 'video', { chained: false, input: { url: 'u', name: 'n' } })).chained, false);
});

test('duplicate: a copy right after, never step 1', () => {
  const base = [mk('a', 'image', { chained: false }), mk('b', 'upscale', { params: { upscale: { model: 'm', factor: 2, refine: false, denoise: 0.3, steps: 12 } } })];
  const d = L.duplicateStepIn(base, 'b', 'b2');
  assert.deepEqual(d.map((s) => s.id), ['a', 'b', 'b2']);
  assert.equal(d[2].name, 'b copy');
  assert.notEqual(d[2].params, d[1].params);
  assert.equal(L.duplicateStepIn(base, 'a', 'x').length, 2);
});

test('stepProblem and the Generate-all refusal', () => {
  assert.equal(L.stepProblem({ kind: 'image' }, { input: 'none' }), null);
  assert.match(L.stepProblem({ kind: 'upscale' }, { input: 'waiting', waitingOn: 1 }), /step 1/);
  assert.match(L.stepProblem({ kind: 'refine' }, { input: 'none' }), /Needs an image/);
  assert.equal(L.stepProblem({ kind: 'video' }, { input: 'none' }), null);
  assert.equal(L.stepProblem({ kind: 'upscale' }, { input: 'chained', missing: 'Pick an upscale model' }), 'Pick an upscale model');
  assert.equal(L.brokenChainMessage([{ index: 0, kind: 'image', problem: null }]), null);
  assert.equal(L.brokenChainMessage([{ index: 1, kind: 'upscale', problem: 'x' }]), 'Step 2 · Upscale: x');
});

test('upscale helpers', () => {
  assert.equal(L.clampFactor(9), 4);
  assert.equal(L.clampFactor(1.3), 1.25);
  assert.equal(L.modelScale('4x-UltraSharp.pth'), 4);
  assert.equal(L.modelScale('RealESRGAN_x2plus.pth'), 2);
  assert.equal(L.modelScale('2xNomosUni_span.safetensors'), 2);
  assert.equal(L.modelScale('weird.pth'), 4);
});
