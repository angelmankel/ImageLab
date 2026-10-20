const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/screens/image/jobs/liveGridLogic.ts');

test('stripCount: a 4-wide strip of 2:3 pictures is 4; a single picture is 1', () => {
  assert.equal(L.stripCount(4 * 683, 1024, 4, 2 / 3), 4);
  assert.equal(L.stripCount(683, 1024, 4, 2 / 3), 1);
  assert.equal(L.stripCount(1024, 1024, 1, 1), 1);
  assert.equal(L.stripCount(2048, 1024, 2, 1), 2);
});

test('bestGrid: 4 squares in a wide box go 4 across; in a square box 2 × 2', () => {
  assert.equal(L.bestGrid(4, 1, 1600, 400, 0).cols, 4);
  const g = L.bestGrid(4, 1, 800, 800, 0);
  assert.equal(g.cols, 2);
  assert.equal(g.rows, 2);
  assert.equal(g.tileW, 400);
  assert.equal(L.bestGrid(3, 2 / 3, 1200, 600, 0).cols, 3);
});

test('stripBackground positions each picture', () => {
  assert.deepEqual(L.stripBackground(0, 4), { backgroundSize: '400% 100%', backgroundPosition: '0% 0' });
  assert.equal(L.stripBackground(3, 4).backgroundPosition, '100% 0');
});
