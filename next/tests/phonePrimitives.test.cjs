// Shared phone primitives (mobile pass, m-shell): pull-to-close and the on-screen keyboard.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const P = load('src/phone/pullLogic.ts');
const K = load('src/phone/keyboardLogic.ts');

test('pull: follows the finger, resists the wrong way', () => {
  assert.equal(P.pullOffset(50), 50);
  assert.ok(P.pullOffset(-100) < 0 && P.pullOffset(-100) >= -24);
});

test('pull: closes past the distance or on a flick, else springs back', () => {
  assert.equal(Math.round(P.closeDistance(300)), 84);
  assert.equal(P.closeDistance(900), 140);
  assert.equal(P.closeDistance(100), 60);
  assert.equal(P.pullCloses(150, 1000, 900), true);
  assert.equal(P.pullCloses(100, 1000, 900), false);
  assert.equal(P.pullCloses(40, 50, 900), true);   // flick
  assert.equal(P.pullCloses(20, 10, 900), false);  // too short even if fast
  assert.equal(P.pullCloses(-80, 50, 900), false);
});

test('pull: axis lock wants a clear pull in the closing direction', () => {
  assert.equal(P.pullAxis(3, 2), null);
  assert.equal(P.pullAxis(20, 5), 'pull');
  assert.equal(P.pullAxis(-20, 5), 'other');
  assert.equal(P.pullAxis(12, 14), 'other');
});

test('hold: broken by moving more than 10px', () => {
  assert.equal(P.holdBroken(6, 6), false);
  assert.equal(P.holdBroken(9, 9), true);
});

test('keyboard inset ignores URL-bar sized changes', () => {
  assert.equal(K.keyboardInset(800, 760, 0), 0);
  assert.equal(K.keyboardInset(800, 460, 0), 340);
  assert.equal(K.keyboardInset(800, 460, 40), 300);
});

test('reveal: a field under the keyboard scrolls up just enough; a visible one stays', () => {
  assert.equal(K.revealDelta(100, 140, 0, 460), 0);
  assert.equal(K.revealDelta(500, 540, 0, 460), 540 - 448);
  assert.equal(K.revealDelta(-20, 20, 0, 460), -32);
  // taller than the band: its top shows
  assert.equal(K.revealDelta(100, 700, 0, 460), 88);
});
