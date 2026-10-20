// Library grid video autoplay rules (src/screens/library/videoAutoplayLogic.ts), loaded from the TS source.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const V = load('src/screens/library/videoAutoplayLogic.ts');
const box = (key, top, height = 100) => ({ key, top, height });

test('zone from the observer entry: off / near / visible at 25%', () => {
  assert.equal(V.zoneFor(false, 0), 'off');
  assert.equal(V.zoneFor(false, 0.9), 'off');
  assert.equal(V.zoneFor(true, 0), 'near');
  assert.equal(V.zoneFor(true, 0.2499), 'near');
  assert.equal(V.zoneFor(true, 0.25), 'visible');
  assert.equal(V.zoneFor(true, 1), 'visible');
  assert.equal(V.VISIBLE_RATIO, 0.25);
  assert.equal(V.ROOT_MARGIN, '100px 0px');
});

test('cap: 3 on the phone, 6 on desktop', () => {
  assert.equal(V.playCap(true), 3);
  assert.equal(V.playCap(false), 6);
});

test('autoplay is off for reduced motion, Save-Data, or a covered grid', () => {
  assert.equal(V.autoplayAllowed({ reducedMotion: false, saveData: false }), true);
  assert.equal(V.autoplayAllowed({ reducedMotion: true, saveData: false }), false);
  assert.equal(V.autoplayAllowed({ reducedMotion: false, saveData: true }), false);
  assert.equal(V.autoplayAllowed({ reducedMotion: false, saveData: false, paused: true }), false);
  assert.equal(V.autoplayAllowed({ reducedMotion: false, saveData: false, paused: false }), true);
});

test('pickPlaying keeps the tiles nearest the view centre, up to the cap', () => {
  const view = { top: 0, height: 600 }; // centre 300
  const tiles = [box('a', 0), box('b', 120), box('c', 240), box('d', 360), box('e', 480), box('f', 600)];
  // centres: a50 b170 c290 d410 e530 f650 -> distances 250 130 10 110 230 350
  assert.deepEqual(V.pickPlaying(tiles, view, 3), ['c', 'd', 'b']);
  assert.deepEqual(V.pickPlaying(tiles, view, 1), ['c']);
  assert.deepEqual(V.pickPlaying(tiles, view, 99), ['c', 'd', 'b', 'e', 'a', 'f']);
});

test('pickPlaying: ties keep grid order, view offset counts, cap 0 / no tiles = nothing', () => {
  const row = [box('l', 250), box('m', 250), box('r', 250)];
  assert.deepEqual(V.pickPlaying(row, { top: 0, height: 600 }, 2), ['l', 'm']);
  // A scroll root that starts 200px down the page: centre is 500.
  assert.deepEqual(V.pickPlaying([box('x', 100), box('y', 450)], { top: 200, height: 600 }, 1), ['y']);
  assert.deepEqual(V.pickPlaying(row, { top: 0, height: 600 }, 0), []);
  assert.deepEqual(V.pickPlaying([], { top: 0, height: 600 }, 6), []);
});

test('pickPlaying does not mutate its input', () => {
  const tiles = [box('a', 500), box('b', 0)];
  const copy = JSON.parse(JSON.stringify(tiles));
  V.pickPlaying(tiles, { top: 0, height: 100 }, 1);
  assert.deepEqual(tiles, copy);
});
