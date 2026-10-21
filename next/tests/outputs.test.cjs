const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/app/outputsLogic.ts');

const sessions = {
  A: { id: 'A', createdAt: 1, legacy: true, steps: [{ id: 'a1' }, { id: 'a2' }] },
  B: { id: 'B', createdAt: 2, steps: [{ id: 'b1' }] },
};
const ctx = (over = {}) => ({ owners: {}, tags: {}, stepSession: L.stepSessionMap(sessions), unsortedId: L.unsortedOf(sessions), ...over });

test('step → session map', () => {
  assert.deepEqual(L.stepSessionMap(sessions), { a1: 'A', a2: 'A', b1: 'B' });
});

test('owner record wins, then the step tag, then Unsorted', () => {
  const c = ctx({ owners: { k1: { sessionId: 'B', stepId: 'gone' } }, tags: { k1: 'a1', k2: 'b1', k3: 'zz' } });
  assert.equal(L.sessionOf('k1', c), 'B');
  assert.equal(L.sessionOf('k2', c), 'B');
  assert.equal(L.sessionOf('k3', c), 'A', 'tag of a removed step → Unsorted');
  assert.equal(L.sessionOf('k4', c), 'A', 'untagged → Unsorted');
});

test('detached outputs belong to nobody; a deleted session keeps its outputs out of the others', () => {
  const c = ctx({ owners: { k1: { sessionId: L.DETACHED, stepId: 'a1' }, k2: { sessionId: 'X', stepId: 'x1' } } });
  assert.equal(L.sessionOf('k1', c), null);
  assert.equal(L.sessionOf('k2', c), 'X');
  assert.deepEqual(L.ownedBy([{ key: 'k1' }, { key: 'k2' }, { key: 'k3' }], 'A', c), [{ key: 'k3' }]);
});

test('no Unsorted session → untagged outputs show nowhere', () => {
  const c = ctx({ unsortedId: null });
  assert.equal(L.sessionOf('k', c), null);
});

test('ownedBy keeps the same array when everything is owned', () => {
  const list = [{ key: 'a' }, { key: 'b' }];
  const c = ctx({ tags: { a: 'b1', b: 'b1' } });
  assert.equal(L.ownedBy(list, 'B', c), list);
});

test('unsorted = the oldest legacy session', () => {
  assert.equal(L.unsortedOf({ x: { id: 'x', createdAt: 5, legacy: true }, y: { id: 'y', createdAt: 3, legacy: true } }), 'y');
  assert.equal(L.unsortedOf({ x: { id: 'x', createdAt: 5 } }), null);
});

test('capRecord keeps the newest keys', () => {
  assert.deepEqual(L.capRecord({ a: 1, b: 2, c: 3 }, 2), { b: 2, c: 3 });
  const r = { a: 1 };
  assert.equal(L.capRecord(r, 2), r);
});

test('isFresh: made after boot (with grace) only', () => {
  assert.equal(L.isFresh(1000, 1000), true);
  assert.equal(L.isFresh(1_000_000 - 60_000, 1_000_000, 120_000), true);
  assert.equal(L.isFresh(1, 1_000_000), false);
  assert.equal(L.isFresh(0, 0), false);
});

test('reassign keeps the step, moves the session', () => {
  const out = L.reassign({ k1: { sessionId: 'A', stepId: 'a1' } }, ['k1', 'k2'], '', { k2: 'b1' });
  assert.deepEqual(out, { k1: { sessionId: '', stepId: 'a1' }, k2: { sessionId: '', stepId: 'b1' } });
});
