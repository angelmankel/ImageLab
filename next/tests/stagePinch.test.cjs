// The stage's pinch maths (src/screens/image/stageZoom.ts): zoom about a point, two-finger
// distance / midpoint, pinch 1:1 with the finger spread, the trackpad (ctrl+wheel) curve.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Z = require('./_load.cjs')('src/screens/image/stageZoom.ts');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

test('zoomTo keeps the point still: offset = point − (point − offset) · new/old', () => {
  const s = { zoom: 2, x: 30, y: -10 };
  const t = Z.zoomTo(s, 3, 100, 40);
  assert.equal(t.zoom, 3);
  close(t.x, 100 - (100 - 30) * 1.5);
  close(t.y, 40 - (40 + 10) * 1.5);
  // The picture point that was under (100, 40) is still under it.
  const px = (100 - s.x) / s.zoom, py = (40 - s.y) / s.zoom;
  close(t.x + px * t.zoom, 100);
  close(t.y + py * t.zoom, 40);
});

test('zoomTo clamps to 1..8, snaps to FIT at the floor, returns the same state when nothing changes', () => {
  const s = { zoom: 2, x: 5, y: 5 };
  assert.equal(Z.zoomTo(s, 50, 10, 10).zoom, 8);
  assert.deepEqual(Z.zoomTo(s, 0.3, 10, 10), Z.FIT);
  assert.equal(Z.zoomTo(s, 2, 10, 10), s);
  assert.equal(Z.zoomTo(Z.FIT, 0.5), Z.FIT);
  // zoomAbout is zoomTo by a factor.
  assert.deepEqual(Z.zoomAbout(s, 1.5, 100, 40), Z.zoomTo(s, 3, 100, 40));
});

test('pinchOf: distance and midpoint of two pointers', () => {
  const p = Z.pinchOf({ x: -30, y: 0 }, { x: 30, y: 80 });
  assert.equal(p.d, 100);
  assert.equal(p.cx, 0);
  assert.equal(p.cy, 40);
});

test('pinch zooms 1:1 with the finger distance about the midpoint', () => {
  const start = Z.startPinch(Z.FIT, Z.pinchOf({ x: -50, y: 20 }, { x: 50, y: 20 }));
  assert.equal(start.d, 100);
  // The anchor is the picture point under the midpoint (0, 20) at fit.
  close(start.ax, 0); close(start.ay, 20);
  // Spread to 200 px, same midpoint: zoom 2, the midpoint's picture point stays put.
  const s2 = Z.pinchTo(start, Z.pinchOf({ x: -100, y: 20 }, { x: 100, y: 20 }));
  assert.equal(s2.zoom, 2);
  close(s2.x + start.ax * 2, 0);
  close(s2.y + start.ay * 2, 20);
  // Spread to 350 px: zoom 3.5, continuous, no steps.
  assert.equal(Z.pinchTo(start, { d: 350, cx: 0, cy: 20 }).zoom, 3.5);
});

test('moving both fingers while pinching pans: the anchor follows the midpoint', () => {
  const s0 = { zoom: 2, x: 10, y: 10 };
  const start = Z.startPinch(s0, { d: 100, cx: 40, cy: 0 });
  const moved = Z.pinchTo(start, { d: 100, cx: 90, cy: 30 });
  assert.equal(moved.zoom, 2);
  close(moved.x, s0.x + 50);
  close(moved.y, s0.y + 30);
  // Zoom and pan together: the anchor lands under the new midpoint.
  const both = Z.pinchTo(start, { d: 150, cx: 90, cy: 30 });
  assert.equal(both.zoom, 3);
  close(both.x + start.ax * 3, 90);
  close(both.y + start.ay * 3, 30);
});

test('pinch clamps to the stage limits and snaps to FIT when the fingers close past fit', () => {
  const start = Z.startPinch({ zoom: 4, x: 0, y: 0 }, { d: 100, cx: 0, cy: 0 });
  assert.equal(Z.pinchTo(start, { d: 400, cx: 0, cy: 0 }).zoom, 8);
  assert.deepEqual(Z.pinchTo(start, { d: 10, cx: 30, cy: 30 }), Z.FIT);
  assert.deepEqual(Z.pinchTo(start, { d: 25, cx: 30, cy: 30 }), Z.FIT);
  // Pinching in at fit changes nothing; so does a pinch whose fingers started on one spot.
  assert.deepEqual(Z.pinchTo(Z.startPinch(Z.FIT, { d: 100, cx: 0, cy: 0 }), { d: 50, cx: 0, cy: 0 }), Z.FIT);
  const s = { zoom: 2, x: 1, y: 1 };
  assert.equal(Z.pinchTo(Z.startPinch(s, { d: 0, cx: 0, cy: 0 }), { d: 50, cx: 0, cy: 0 }), s);
});

test('trackpad pinch (ctrl+wheel) curve: steeper than the wheel, same direction', () => {
  assert.ok(Z.trackpadFactor(-10) > 1);
  assert.ok(Z.trackpadFactor(10) < 1);
  close(Z.trackpadFactor(10) * Z.trackpadFactor(-10), 1);
  assert.ok(Z.trackpadFactor(-10) > Z.wheelFactor(-10));
});
