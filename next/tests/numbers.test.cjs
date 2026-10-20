// The shared Slider / NumberField number rules (src/ui/numberLogic.ts): snap, nudge, typed input,
// the cog's range override.
const test = require('node:test');
const assert = require('node:assert');
const N = require('../src/ui/numberLogic.ts');

test('decimalsOf / tidy', () => {
  assert.equal(N.decimalsOf(1), 0);
  assert.equal(N.decimalsOf(0.5), 1);
  assert.equal(N.decimalsOf(0.05), 2);
  assert.equal(N.decimalsOf(1e-7), 7);
  assert.equal(N.tidy(0.1 + 0.2, 0.1), 0.3);
});

test('snap: grid from min, clamped', () => {
  assert.equal(N.snap(7.3, 1, 15, 0.5), 7.5);
  assert.equal(N.snap(99, 1, 60, 1), 60);
  assert.equal(N.snap(-3, 0, 1, 0.01), 0);
  assert.equal(N.snap(0.333, 0, 1, 0.05), 0.35);
  assert.equal(N.snap(13, 5, 161, 4), 13); // frames 4n + 5
  assert.equal(N.snap(14, 5, 161, 4), 13);
  assert.equal(N.snap(NaN, 2, 9, 1), 2);
});

test('nudge: one step, Shift ten, off-grid goes to the next line', () => {
  assert.equal(N.nudge(20, 1, 1, 60, 1), 21);
  assert.equal(N.nudge(20, -1, 1, 60, 1, 10), 10);
  assert.equal(N.nudge(60, 1, 1, 60, 1), 60);
  assert.equal(N.nudge(0.7, 1, 0, 2, 0.05), 0.75);
  assert.equal(N.nudge(0.72, 1, 0, 2, 0.05), 0.75);
  assert.equal(N.nudge(0.72, -1, 0, 2, 0.05), 0.7);
});

test('parseTyped', () => {
  assert.equal(N.parseTyped('12'), 12);
  assert.equal(N.parseTyped(' 1,5 '), 1.5);
  assert.equal(N.parseTyped('.35'), 0.35);
  assert.equal(N.parseTyped('-2'), -2);
  assert.equal(N.parseTyped('30 steps'), 30);
  assert.equal(N.parseTyped('×1.5'), 1.5);
  assert.equal(N.parseTyped(''), null);
  assert.equal(N.parseTyped('.'), null);
  assert.equal(N.parseTyped('abc'), null);
});

test('effectiveRange: override field by field, nonsense falls back', () => {
  const base = { min: 1, max: 60, step: 1 };
  assert.deepEqual(N.effectiveRange(base, null), base);
  assert.deepEqual(N.effectiveRange(base, { max: 150 }), { min: 1, max: 150, step: 1 });
  assert.deepEqual(N.effectiveRange(base, { min: 80 }), base);
  assert.deepEqual(N.effectiveRange(base, { step: 0 }), base);
  assert.deepEqual(N.effectiveRange(base, { step: 5 }), { min: 1, max: 60, step: 5 });
  assert.deepEqual(N.effectiveRange(base, { step: 100 }), base);
  assert.equal(N.isOverridden(base, { max: 60 }), false);
  assert.equal(N.isOverridden(base, { max: 61 }), true);
});

test('inputModeFor', () => {
  assert.equal(N.inputModeFor(1, 0), 'numeric');
  assert.equal(N.inputModeFor(0.05, 0), 'decimal');
  assert.equal(N.inputModeFor(1, -10), 'decimal');
});
