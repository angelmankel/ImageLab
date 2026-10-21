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

const S = load('src/compose/sizeLogic.ts');

test('model default = native pixel count in the shape, on the 64 grid (SDXL buckets)', () => {
  const sz = (area, id) => { const r = S.ratioById(id); const s = S.sizeForArea(area, r.w, r.h); return `${s.width}x${s.height}`; };
  const xl = 1024 * 1024;
  assert.equal(sz(xl, '1:1'), '1024x1024');
  assert.equal(sz(xl, '2:3'), '832x1216');
  assert.equal(sz(xl, '3:2'), '1216x832');
  assert.equal(sz(xl, '9:16'), '768x1344');
  assert.equal(sz(xl, '16:9'), '1344x768');
  assert.equal(sz(512 * 512, '1:1'), '512x512');
  for (const id of ['2:3', '3:4', '4:5', '9:16', '3:2', '5:4']) {
    const r = S.ratioById(id); const s = S.sizeForArea(xl, r.w, r.h);
    assert.ok(s.width * s.height <= xl, id); assert.equal(s.width % 64, 0); assert.equal(s.height % 64, 0);
  }
  assert.equal(S.nativeArea({ width: 512, height: 512 }), 262144);
  assert.equal(S.nativeArea(null), xl);
});

test('shapes, flips, nearest ratio', () => {
  assert.equal(S.flipRatio('2:3'), '3:2'); assert.equal(S.flipRatio('16:9'), '9:16'); assert.equal(S.flipRatio('1:1'), '1:1');
  assert.equal(S.orientOf(832, 1216), 'portrait'); assert.equal(S.orientOf(1024, 1024), 'square'); assert.equal(S.orientOf(1344, 768), 'landscape');
  assert.equal(S.nearestRatio(832, 1216).id, '2:3'); assert.equal(S.nearestRatio(1344, 768).id, '16:9'); assert.equal(S.nearestRatio(0, 5).id, '1:1');
  assert.equal(S.orientOfRatio(S.ratioById('5:4')), 'landscape');
});

test('steps of 64, snaps, img2img sizes', () => {
  assert.equal(S.stepSide(1000, 1), 1024); assert.equal(S.stepSide(1000, -1), 960); assert.equal(S.stepSide(1024, 1), 1088); assert.equal(S.stepSide(256, -1), 256);
  assert.equal(S.snapSide(1001), 1000); assert.equal(S.snapSide(99999), 4096); assert.equal(S.snapSide(NaN), 1024);
  assert.deepEqual(S.scaleStep(832, 1216, 1), { width: 896, height: 1280 });
  assert.deepEqual(S.scaledInput(2000, 1000, 1024, 1024), { width: 1024, height: 512 });
  assert.deepEqual(S.scaledInput(500, 1000, 1024, 1024), { width: 512, height: 1024 });
  assert.equal(S.nativeLongSide(800, 1200, 1024 * 1024), 1216);
  assert.equal(S.pictureLongSide(6000, 4000), 4096);
});

test('item 34: shape chips, S / M / L, lock, crop', () => {
  assert.deepEqual([...S.SHAPES], ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '3:2', '4:3']);
  for (const id of S.SHAPES) assert.equal(S.ratioById(id).id, id);
  const xl = 1024 * 1024;
  assert.equal(S.presetArea(xl, 'model'), xl);
  const r = S.ratioById('2:3');
  const s = S.sizeForArea(S.presetArea(xl, 's'), r.w, r.h); const l = S.sizeForArea(S.presetArea(xl, 'l'), r.w, r.h);
  assert.ok(s.width * s.height < xl && l.width * l.height > xl, 'S smaller, L larger than the model default');
  assert.equal(s.width % 64, 0); assert.equal(l.height % 64, 0);
  assert.deepEqual(S.lockedPair('width', 900, 2 / 3), { width: 904, height: 1360 });
  assert.deepEqual(S.lockedPair('height', 1024, 16 / 9), { width: 1824, height: 1024 });
  assert.equal(S.snap8(1001), 1000);
  assert.equal(S.megapixels(832, 1216), '1.0 MP');
  assert.deepEqual(S.cropRect(952, 1024, 3, 4), { x: 92, y: 0, width: 768, height: 1024 });
  assert.deepEqual(S.cropRect(1000, 500, 1, 1), { x: 250, y: 0, width: 500, height: 500 });
  assert.deepEqual(S.cropRect(1000, 1000, 16, 9), { x: 0, y: 218, width: 1000, height: 563 });
  assert.equal(S.longForSide(952, 1024, 'width', 800), 864);
  assert.equal(S.longForSide(952, 1024, 'height', 1200), 1200);
});
