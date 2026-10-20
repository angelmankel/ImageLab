// The phone shell's pure logic (src/screens/phone/phoneLogic.ts), loaded straight from source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function load() {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/phone/phoneLogic.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Math, Number, String });
  return exports;
}
const p = load();

test('a press: tap, hold at 500 ms, cancel when the finger moves', () => {
  assert.equal(p.HOLD_MS, 500);
  assert.equal(p.pressOutcome(0, 0), 'tap');
  assert.equal(p.pressOutcome(499, 3), 'tap');
  assert.equal(p.pressOutcome(500, 0), 'hold');
  assert.equal(p.pressOutcome(900, 10), 'hold');
  assert.equal(p.pressOutcome(100, 11), 'cancel');
  assert.equal(p.pressOutcome(900, 40), 'cancel');
});

test('seed mode toggles and the button face follows it; running = Stop', () => {
  assert.equal(p.toggleSeedMode('set'), 'random');
  assert.equal(p.toggleSeedMode('random'), 'set');
  assert.equal(p.generateFace(false, 'set'), 'bolt');
  assert.equal(p.generateFace(false, 'random'), 'dice');
  assert.equal(p.generateFace(true, 'random'), 'stop');
  assert.equal(p.generateFace(true, 'set'), 'stop');
});

test('badge text', () => {
  assert.equal(p.badgeText(0), null);
  assert.equal(p.badgeText(-1), null);
  assert.equal(p.badgeText(3), '3');
  assert.equal(p.badgeText(9), '9');
  assert.equal(p.badgeText(12), '9+');
});

test('swipe → step index, null at the ends', () => {
  // finger left (-1) = next step; finger right (+1) = previous.
  assert.equal(p.stepForSwipe(0, -1, 3), 1);
  assert.equal(p.stepForSwipe(1, 1, 3), 0);
  assert.equal(p.stepForSwipe(0, 1, 3), null);
  assert.equal(p.stepForSwipe(2, -1, 3), null);
  assert.equal(p.stepForSwipe(0, -1, 1), null);
});

test('drag offset: 1:1 with a neighbour, rubber band without, never past the width', () => {
  assert.equal(p.pageDragOffset(-120, true, 390), -120);
  const r = p.pageDragOffset(-120, false, 390);
  assert.ok(r < 0 && r > -120, `rubber ${r}`);
  assert.ok(Math.abs(p.pageDragOffset(5000, false, 390)) < 390);
  assert.equal(p.pageDragOffset(0, false, 390), 0);
  assert.equal(p.pageSettleOffset(-1, 390), -(390 + p.PAGE_GAP));
  assert.equal(p.pageSettleOffset(1, 390), 390 + p.PAGE_GAP);
});

test('labels, progress and which rows are this step', () => {
  assert.equal(p.stepChipLabel(0, 'Image'), '1 · Image');
  assert.equal(p.progressFraction(0.4), 0.4);
  assert.equal(p.progressFraction(40), 0.4);
  assert.equal(p.progressFraction({ value: 5, max: 20 }), 0.25);
  assert.equal(p.progressFraction({ value: 5, max: 0 }), null);
  assert.equal(p.progressFraction(undefined), null);
  assert.equal(p.rowIsStep('a', 'a', false), true);
  assert.equal(p.rowIsStep('b', 'a', true), false);
  assert.equal(p.rowIsStep(undefined, 'a', true), true);
  assert.equal(p.rowIsStep(undefined, 'a', false), false);
});
