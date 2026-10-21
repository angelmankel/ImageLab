const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('./_load.cjs')('src/app/monolith.ts');

test('cut grows as the mark shrinks: 16 → 11, 24 → 9, 48 → 7, big → 5.5', () => {
  assert.equal(M.cutFor(16), 11);
  assert.equal(M.cutFor(24), 9);
  assert.equal(M.cutFor(48), 7);
  assert.equal(M.cutFor(400), 5.5);
  assert.ok(M.cutFor(30) < 9 && M.cutFor(30) > 7);
});

test('optical centring matches the spec table', () => {
  for (const [cut, off] of [[5.5, -0.3], [6.5, -0.7], [7, -0.9], [9, -1.8], [11, -2.7]]) {
    assert.ok(Math.abs(M.yOffsetFor(cut) - off) < 0.06, `${cut}: ${M.yOffsetFor(cut)}`);
  }
  assert.equal(M.viewBoxFor(6.5), '0 -0.71 100 100');
});

test('the mark is three filled pieces, the cut subtracted (no strokes, no background colour)', () => {
  const d = M.markPath(6.5);
  assert.equal((d.match(/M/g) || []).length, 3);
  assert.ok(!M.markSvg(24).includes('stroke'));
  // nothing inside the vertical cut below the centre: every point there is at least half the cut from x = 50
  const pts = d.replace(/Z/g, '').split(/[ML]/).filter(Boolean).map((p) => p.trim().split(' ').map(Number));
  for (const [x, y] of pts) if (y > 45) assert.ok(Math.abs(x - 50) >= 3.24, `${x},${y}`);
});

test('tiles: blue, no orange; maskable is full bleed', () => {
  const t = M.tileSvg(192);
  assert.match(t, /rx="23" fill="#2f7cf6"/);
  assert.ok(!/F0863A|FFB36B/i.test(t + M.tileSvg(512, { maskable: true })));
  assert.match(M.tileSvg(512, { maskable: true }), /<rect width="100" height="100" fill="#2f7cf6"\/>/);
});
