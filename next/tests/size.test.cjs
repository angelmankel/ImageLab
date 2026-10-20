const test = require('node:test');
const assert = require('node:assert');
// Node strips the types: size.ts imports nothing, so it loads from source.
const S = require('../src/screens/image/settings/size.ts');

test('aspect × longest side → W × H on the 64 grid', () => {
  assert.deepEqual(S.sizeFor(S.aspectById('1:1'), 1024), { width: 1024, height: 1024 });
  assert.deepEqual(S.sizeFor(S.aspectById('3:4'), 1024), { width: 768, height: 1024 });
  assert.deepEqual(S.sizeFor(S.aspectById('4:3'), 1024), { width: 1024, height: 768 });
  assert.deepEqual(S.sizeFor(S.aspectById('9:16'), 1024), { width: 576, height: 1024 });
  assert.deepEqual(S.sizeFor(S.aspectById('16:9'), 1344), { width: 1344, height: 768 }); // the SDXL bucket
  assert.deepEqual(S.sizeFor(S.aspectById('2:3'), 1216), { width: 832, height: 1216 });  // the SDXL bucket
  assert.deepEqual(S.sizeFor(S.aspectById('4:5'), 1024), { width: 832, height: 1024 });
  assert.deepEqual(S.sizeFor(S.aspectById('3:2'), 2048), { width: 2048, height: 1344 });
});

test('the longest side is snapped to the grid too', () => {
  assert.deepEqual(S.sizeFor(S.aspectById('1:1'), 1000), { width: 1024, height: 1024 });
});

test('a custom size keeps its own ratio when the longest side changes', () => {
  assert.deepEqual(S.scaleToLongest(1000, 500, 2048), { width: 2048, height: 1024 });
  assert.deepEqual(S.scaleToLongest(0, 0, 1024), { width: 1024, height: 1024 });
});

test('aspectOf names the buckets and falls back to custom', () => {
  assert.equal(S.aspectOf(1024, 1024), '1:1');
  assert.equal(S.aspectOf(832, 1216), '2:3');
  assert.equal(S.aspectOf(1216, 832), '3:2');
  assert.equal(S.aspectOf(1344, 768), '16:9');
  assert.equal(S.aspectOf(768, 1344), '9:16');
  assert.equal(S.aspectOf(832, 1024), '4:5');
  assert.equal(S.aspectOf(1000, 1024), '1:1'); // near enough to square
  assert.equal(S.aspectOf(1000, 1400), 'custom');
  assert.equal(S.aspectOf(0, 1024), 'custom');
});

test('aspect → longest → size round-trips to the same button and chip', () => {
  for (const a of S.ASPECTS) for (const l of S.LONGEST_SIDES) {
    const { width, height } = S.sizeFor(a, l);
    assert.equal(S.aspectOf(width, height), a.id, `${a.id} @ ${l}`);
    assert.equal(S.longestOf(width, height), l);
    assert.equal(S.longestChip(width, height), l);
    assert.equal(S.isPresetSize(width, height), true);
  }
  assert.equal(S.isPresetSize(1000, 1000), false);
  assert.equal(S.longestChip(1000, 1000), null);
});

test('manual snapping: sliders on 64, boxes on 8, both clamped', () => {
  assert.equal(S.snap(1000, S.SLIDER_MIN, S.SLIDER_MAX, S.SLIDER_STEP), 1024);
  assert.equal(S.snap(100, S.SLIDER_MIN, S.SLIDER_MAX, S.SLIDER_STEP), 256);
  assert.equal(S.snap(9999, S.SLIDER_MIN, S.SLIDER_MAX, S.SLIDER_STEP), 2048);
  assert.equal(S.snap(1003, S.BOX_MIN, S.BOX_MAX, S.BOX_STEP), 1000);
  assert.equal(S.snap(NaN, S.BOX_MIN, S.BOX_MAX, S.BOX_STEP), 64);
  assert.equal(S.roundTo(0, 64), 64);
});

test('labels', () => {
  assert.equal(S.fmtSize(1024, 768), '1024 × 768');
  assert.equal(S.megapixels(1024, 1024), '1.05');
});
