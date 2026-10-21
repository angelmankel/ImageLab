// ImageLabCore 825f446: /hashes sends `pending` + `progress`; pending files never join the hash list.
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const modelHash = load('../src/lib/modelHash.ts');
const H = load('../src/lib/hashPending.ts', { './modelHash': modelHash, zustand: { create: () => () => ({}) } });

test('only entries with a hash count; older nodes (no fields) keep working', () => {
  assert.deepEqual(H.withHash([{ key: 'a', filename: 'a', hash: 'AB' }, { key: 'b', filename: 'b' }, { key: 'c', filename: 'c', hash: '' }]).map((m) => m.key), ['a']);
  assert.deepEqual(H.withHash(undefined), []);
  assert.equal(H.mergeProgress([undefined, undefined]), undefined);
});

test('progress sums across servers; ready only when every server is ready', () => {
  assert.deepEqual(H.mergeProgress([{ hashed: 100, total: 104, pending: 4, ready: true }, undefined, { hashed: 40, total: 42, pending: 2, ready: false }]), { hashed: 140, total: 146, pending: 6, ready: false });
});

test('a file hashing state matches like findModelHash, and a hashed copy wins', () => {
  const pending = [{ key: 'loras/x.safetensors', filename: 'x.safetensors', state: 'hashing' }, { key: 'embeddings/neg.pt', filename: 'neg.pt', state: 'queued' }];
  assert.equal(H.hashStateFor(pending, [], 'x.safetensors'), 'hashing');
  assert.equal(H.hashStateFor(pending, [], 'neg'), 'queued');
  assert.equal(H.hashStateFor(pending, [{ key: 'loras/x.safetensors', filename: 'x.safetensors', hash: 'AA' }], 'x.safetensors'), undefined);
  assert.equal(H.hashStateFor(pending, [], 'other.safetensors'), undefined);
});
