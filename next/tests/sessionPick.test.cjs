const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/app/sessionPickLogic.ts');

const history = [
  { id: 'e3', promptId: 'p2' }, // a batch of p2: first picture on top
  { id: 'e4', promptId: 'p2' },
  { id: 'e1', promptId: 'p1' },
];
const runs = [[{ url: 'u-new', promptId: 'p9' }, { url: 'u-new2', promptId: 'p9' }, { url: 'u-old', promptId: 'p8' }]];

test('a finished image job makes its first picture current (batch: the first one)', () => {
  assert.deepEqual(L.landedPick('p2', history, runs), { kind: 'entry', key: 'e3' });
  assert.deepEqual(L.landedPick('p1', history, runs), { kind: 'entry', key: 'e1' });
});

test('a finished run makes its first result current', () => {
  assert.deepEqual(L.landedPick('p9', history, runs), { kind: 'run', key: 'u-new' });
});

test('output not there yet → null (picked when it lands)', () => {
  assert.equal(L.landedPick('p404', history, runs), null);
});

test('ended jobs: in prev, gone from next', () => {
  assert.deepEqual([...L.endedJobs(['a', 'b', 'c'], ['b'])], ['a', 'c']);
  assert.deepEqual([...L.endedJobs([], ['b'])], []);
});
