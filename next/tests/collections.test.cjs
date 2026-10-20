// Collections in the history panel (src/screens/image/collections/collectionsLogic.ts).
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const L = load('src/screens/image/collections/collectionsLogic.ts');

const cs = () => [
  { id: 'a', name: 'Collection 1', itemIds: ['x', 'y'] },
  { id: 'b', name: 'Faces', itemIds: ['z'] },
];

test('moveInto takes the item out of every other collection and appends it', () => {
  const out = L.moveInto(cs(), 'b', 'x');
  assert.deepEqual(out.map((c) => c.itemIds), [['y'], ['z', 'x']]);
  // moving within the same one makes it the newest
  assert.deepEqual(L.moveInto(cs(), 'a', 'x')[0].itemIds, ['y', 'x']);
});

test('removeEverywhere / collectionOf', () => {
  assert.deepEqual(L.removeEverywhere(cs(), 'y').map((c) => c.itemIds), [['x'], ['z']]);
  assert.equal(L.collectionOf(cs(), 'z').id, 'b');
  assert.equal(L.collectionOf(cs(), 'q'), null);
});

test('restoreAt puts a deleted collection back at its place once', () => {
  const [a, b] = cs();
  assert.deepEqual(L.restoreAt([b], a, 0).map((c) => c.id), ['a', 'b']);
  assert.deepEqual(L.restoreAt([a, b], a, 0).map((c) => c.id), ['a', 'b']);
  assert.deepEqual(L.restoreAt([b], a, 9).map((c) => c.id), ['b', 'a']);
});

test('nextName skips names in use', () => {
  assert.equal(L.nextName([]), 'Collection 1');
  assert.equal(L.nextName(cs()), 'Collection 3');
  assert.equal(L.nextName([{ id: 'q', name: 'Collection 2', itemIds: [] }]), 'Collection 3');
});

test('shownIds / coverId: newest first, gone items skipped', () => {
  const c = { id: 'a', name: 'A', itemIds: ['1', '2', '3'] };
  const exists = (id) => id !== '3';
  assert.deepEqual(L.shownIds(c, exists), ['2', '1']);
  assert.equal(L.coverId(c, exists), '2');
  assert.equal(L.coverId({ id: 'e', name: 'E', itemIds: [] }, exists), null);
});
