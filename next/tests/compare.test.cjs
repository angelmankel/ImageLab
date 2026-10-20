// Item 23, Compare split view: src/screens/image/compareLogic.ts (pure).
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/screens/image/compareLogic.ts');

const items = [
  { key: 'n', kind: 'image' }, { key: 'v', kind: 'video' }, { key: 'm', kind: 'image' }, { key: 'o', kind: 'image' },
];

test('compareIndex: picked, then the source, then the older image, then the newer', () => {
  assert.equal(C.compareIndex(items, 0, 'o', null), 3);
  assert.equal(C.compareIndex(items, 0, null, 'o'), 3);
  assert.equal(C.compareIndex(items, 0, 'gone', null), 2, 'skips the video');
  assert.equal(C.compareIndex(items, 3, null, null), 2, 'the last one compares with a newer one');
  assert.equal(C.compareIndex(items, 0, 'n', null), 2, 'never itself');
  assert.equal(C.compareIndex([{ key: 'a', kind: 'image' }], 0, null, null), -1);
});

test('stepCompare: wraps, skips the shown one and videos', () => {
  assert.equal(C.stepCompare(items, 0, 2, 1), 3);
  assert.equal(C.stepCompare(items, 0, 3, 1), 2);
  assert.equal(C.stepCompare(items, 0, 2, -1), 3);
});

test('splitAt clamps to 0..100', () => {
  assert.equal(C.splitAt(150, 100, 200), 25);
  assert.equal(C.splitAt(0, 100, 200), 0);
  assert.equal(C.splitAt(999, 100, 200), 100);
  assert.equal(C.splitAt(5, 0, 0), 50);
});

test('fitBox contains and centres', () => {
  assert.deepEqual(C.fitBox(100, 50, 200, 200), { left: 0, top: 50, width: 200, height: 100 });
  assert.deepEqual(C.fitBox(50, 100, 200, 100), { left: 75, top: 0, width: 50, height: 100 });
});
