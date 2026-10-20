const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const L = load('src/compose/inputLogic.ts');

test('source choices say what they do', () => {
  const c = L.sourceChoices(1);
  assert.deepEqual(c.map((x) => x.key), ['off', 'auto', 'pick']);
  assert.deepEqual(c.map((x) => x.label), ['My image', 'Last from 1', 'Pick from 1']);
  assert.equal(L.sourceChoices(3)[2].label, 'Pick from 3');
});

test('origin of a drop', () => {
  assert.equal(L.originOfDrop({ kind: 'file' }), 'drop');
  assert.equal(L.originOfDrop({ kind: 'url', url: 'https://civitai.com/a.jpg', payload: null }), 'web');
  assert.equal(L.originOfDrop({ kind: 'url', url: 'blob:x', payload: null }), 'drop');
  assert.equal(L.originOfDrop({ kind: 'url', url: 'u', payload: { source: 'canvas' } }), 'canvas');
  assert.equal(L.originOfDrop({ kind: 'url', url: 'u', payload: { source: 'other' } }), 'history');
  assert.equal(L.originOfDrop({ kind: 'url', url: 'u', payload: { source: 'model' } }), 'model');
});

test('displayName strips folders, [input], urls', () => {
  assert.equal(L.displayName('sub/dir/12-portrait.png [input]'), '12-portrait.png');
  assert.equal(L.displayName('data:image/png;base64,xx'), 'image.png');
  assert.equal(L.displayName('https://h/view?filename=a.png&type=input'), 'a.png');
  assert.equal(L.displayName(''), 'image.png');
  assert.equal(L.displayName('C:\\pics\\b.jpg'), 'b.jpg');
});

test('slotLabel hides raw node names', () => {
  assert.equal(L.slotLabel('Load Image', 0), 'Input image');
  assert.equal(L.slotLabel('LoadImage', 1), 'Picture 2');
  assert.equal(L.slotLabel('Pose reference', 1), 'Pose reference');
  assert.equal(L.slotLabel('Face', 0), 'Face');
  assert.equal(L.slotLabel('', 2), 'Picture 3');
});

test('valueRef: short stays, long is fingerprinted and stable', () => {
  assert.equal(L.valueRef('a.png'), 'a.png');
  const big = 'data:image/png;base64,' + 'x'.repeat(5000);
  assert.equal(L.valueRef(big), L.valueRef(big));
  assert.notEqual(L.valueRef(big), L.valueRef(big + 'y'));
  assert.ok(L.valueRef(big).length < 120);
  assert.equal(L.fmtDims(832, 1216), '832 × 1216');
  assert.equal(L.fmtDims(0, 5), '');
});
