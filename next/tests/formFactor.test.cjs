// Form factor (mobile pass, m-shell): src/app/formFactorLogic.ts — phone in landscape gets the phone shell,
// tablets keep desktop, a keyboard never flips orientation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const F = load('src/app/formFactorLogic.ts');
const touch = (vw, vh, sw, sh, type) => F.computeFormFactor({ vw, vh, sw, sh, coarse: true, orientationType: type ?? null });
const mouse = (vw, vh) => F.computeFormFactor({ vw, vh, sw: 1920, sh: 1080, coarse: false, orientationType: 'landscape-primary' });

test('phone portrait and landscape both get the phone shell', () => {
  const p = touch(393, 852, 393, 852, 'portrait-primary');
  assert.equal(p.phone, true); assert.equal(p.portrait, true); assert.equal(p.short, 393); assert.equal(p.long, 852);
  const l = touch(852, 393, 852, 393, 'landscape-primary');
  assert.equal(l.phone, true); assert.equal(l.landscape, true);
  // iOS: screen.width/height do not swap on rotation
  assert.equal(touch(932, 430, 430, 932, 'landscape-primary').phone, true);
});

test('tablets keep desktop, a small tablet in portrait stays phone as before', () => {
  assert.equal(touch(820, 1180, 820, 1180, 'portrait-primary').phone, false);
  assert.equal(touch(1180, 820, 820, 1180, 'landscape-primary').phone, false);
  assert.equal(touch(744, 1133, 744, 1133, 'portrait-primary').phone, true);
  assert.equal(touch(1133, 744, 744, 1133, 'landscape-primary').phone, false);
});

test('mouse: width rule unchanged; a short window is not a phone', () => {
  assert.equal(mouse(700, 900).phone, true);
  assert.equal(mouse(1400, 400).phone, false);
  assert.equal(mouse(700, 400).landscape, true);
});

test('keyboard shrinking the window never flips a touch device to landscape', () => {
  const k = touch(393, 300, 393, 852, 'portrait-primary');
  assert.equal(k.phone, true); assert.equal(k.portrait, true);
  // no screen.orientation: falls back to the window shape
  assert.equal(touch(852, 393, 393, 852, null).landscape, true);
});

test('sameFormFactor compares every field', () => {
  const a = touch(393, 852, 393, 852, 'portrait-primary');
  assert.equal(F.sameFormFactor(a, { ...a }), true);
  assert.equal(F.sameFormFactor(a, { ...a, short: 1 }), false);
});
