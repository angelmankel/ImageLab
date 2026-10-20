const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('./_load.cjs')('src/app/batchCycle.ts', { zustand: { create: () => () => () => undefined }, 'zustand/middleware': { persist: (f) => f } });

test('cycle wraps: 1 → 2 → 3 → 1; a custom list 1 / 3 / 5', () => {
  assert.equal(B.nextInCycle([1, 2, 3], 1), 2);
  assert.equal(B.nextInCycle([1, 2, 3], 3), 1);
  assert.equal(B.nextInCycle([1, 3, 5], 3), 5);
  assert.equal(B.nextInCycle([1, 3, 5], 5), 1);
});

test('a value not in the list goes to the next larger, else the first', () => {
  assert.equal(B.nextInCycle([1, 3, 5], 2), 3);
  assert.equal(B.nextInCycle([1, 3, 5], 9), 1);
});

test('cleanCycle: sorted, unique, 1..16, never empty', () => {
  assert.deepEqual(B.cleanCycle([5, 1, 5, 0, 40, 3]), [1, 3, 5]);
  assert.deepEqual(B.cleanCycle([]), [1, 2, 3]);
});
