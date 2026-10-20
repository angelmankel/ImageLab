const { test } = require('node:test');
const assert = require('node:assert/strict');
const Z = require('./_load.cjs')('src/screens/image/stageZoom.ts');
const G = require('./_load.cjs')('src/screens/image/gpuLabel.ts');

test('zoom clamps to 1..8 and snaps back to fit', () => {
  assert.equal(Z.clampZoom(0.2), 1);
  assert.equal(Z.clampZoom(20), 8);
  const z2 = Z.zoomAbout(Z.FIT, 2);
  assert.equal(z2.zoom, 2);
  assert.deepEqual(Z.zoomAbout(z2, 0.5), Z.FIT);
  assert.equal(Z.zoomAbout(Z.FIT, 0.5), Z.FIT);
});

test('zooming about a point keeps that point still', () => {
  const s = Z.zoomAbout(Z.FIT, 2, 100, 50);
  // The picture point under (100, 50) was at picture-coord (100, 50); after 2x about it, it maps back to (100, 50).
  assert.equal(s.x + 100 * 2, 100);
  assert.equal(s.y + 50 * 2, 50);
});

test('pan only when zoomed; wheel factor direction', () => {
  assert.deepEqual(Z.panBy(Z.FIT, 10, 10), Z.FIT);
  assert.deepEqual(Z.panBy({ zoom: 2, x: 0, y: 0 }, 10, -4), { zoom: 2, x: 10, y: -4 });
  assert.ok(Z.wheelFactor(-100) > 1);
  assert.ok(Z.wheelFactor(100) < 1);
  assert.equal(Z.transformOf({ zoom: 2, x: 3, y: 4 }), 'translate(3px, 4px) scale(2)');
});

test('gpu label from system_stats names', () => {
  assert.equal(G.gpuLabel('cuda:0 NVIDIA B200 : cudaMallocAsync'), 'B200');
  assert.equal(G.gpuLabel('cuda:0 NVIDIA GeForce RTX 4090 : native'), 'RTX 4090');
  assert.equal(G.gpuLabel('cuda:0 NVIDIA A100-SXM4-80GB : cudaMallocAsync'), 'A100-SXM4-80GB');
  assert.equal(G.gpuLabel(undefined), '');
});
