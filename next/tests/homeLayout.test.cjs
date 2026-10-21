const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_load.cjs')('src/screens/home/homeLayout.ts');

test('columnsFor / deal: reading order', () => {
  assert.equal(H.columnsFor(1000, 220, 12), 4);
  assert.equal(H.columnsFor(100, 220, 12), 1);
  assert.deepEqual(H.deal([0, 1, 2, 3, 4], 3), [[0, 3], [1, 4], [2]]);
});

test('ghostsFor: fills each column to the target, no slivers, capped', () => {
  const g = H.ghostsFor([300, 0, 900], 800, 200, 12);
  const sum = (a, h) => a.reduce((s, x) => s + x + 12, h > 0 ? 0 : -12) + h;
  assert.ok(g[0].length > 0 && Math.abs(sum(g[0], 300) - 800) < 64);
  assert.ok(g[1].every((x) => x >= 64));
  assert.deepEqual(g[2], []);
  assert.ok(H.ghostsFor([0, 0, 0], 100000, 200, 12, 64, 5).flat().length <= 5);
});
