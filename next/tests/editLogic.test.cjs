const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./_load.cjs')('src/canvas/edit/editLogic.ts');
const G = require('./_load.cjs')('src/canvas/edit/toolGraphs.ts');
const V = require('./_load.cjs')('src/canvas/gpu/gpuView.ts');

test('look: neutral has no filter; sliders map to colour-matrix calls in order', () => {
  assert.equal(E.isNeutralLook(E.NEUTRAL_LOOK), true);
  assert.deepEqual(E.lookMatrix(E.NEUTRAL_LOOK), []);
  const l = { ...E.NEUTRAL_LOOK, brightness: 20, contrast: -50, hue: 90, invert: true };
  assert.deepEqual(E.lookMatrix(l), [['brightness', 1.2], ['contrast', -0.5], ['hue', 90], ['negative']]);
  assert.equal(E.isNeutralLook({ ...E.NEUTRAL_LOOK, blur: 3 }), false);
});

test('history: commit / undo / redo / merge / reset', () => {
  let h = E.startHistory('a');
  h = E.commit(h, 'b');
  h = E.commit(h, 'c');
  assert.equal(E.undoH(h).present, 'b');
  assert.equal(E.redoH(E.undoH(h)).present, 'c');
  const m = E.commit(h, 'c2', true);
  assert.deepEqual(m.past, ['a', 'b'], 'a merged change replaces the present');
  const r = E.resetH(h);
  assert.equal(r.present, 'a');
  assert.equal(E.undoH(r).present, 'c', 'reset is one undoable step');
  assert.equal(E.commit(E.undoH(h), 'x').future.length, 0, 'a new edit drops the redo side');
});

test('crop: ratio rect is centred and as large as fits', () => {
  assert.deepEqual(E.ratioRect(1000, 500, 1), { x: 250, y: 0, w: 500, h: 500 });
  assert.deepEqual(E.ratioRect(1000, 500, null), { x: 0, y: 0, w: 1000, h: 500 });
  assert.deepEqual(E.ratioRect(400, 800, 16 / 9), { x: 0, y: 288, w: 400, h: 225 });
});

test('crop drag: move stays inside; edges clamp; min size; ratio corners keep the shape', () => {
  const r = { x: 100, y: 100, w: 200, h: 200 };
  assert.deepEqual(E.dragCrop(r, 'move', 1000, -1000, 500, 500), { x: 300, y: 0, w: 200, h: 200 });
  assert.deepEqual(E.dragCrop(r, 'e', 1000, 0, 500, 500), { x: 100, y: 100, w: 400, h: 200 });
  assert.equal(E.dragCrop(r, 'w', 1000, 0, 500, 500).w, E.MIN_CROP);
  const c = E.dragCrop(r, 'se', 100, 20, 1000, 1000, 1);
  assert.equal(c.w, c.h);
  assert.equal(c.x, 100); assert.equal(c.y, 100);
  const nw = E.dragCrop(r, 'nw', -500, -500, 1000, 1000, 2);
  assert.ok(nw.x >= 0 && nw.y >= 0);
  assert.equal(Math.round(nw.w / nw.h), 2);
  assert.equal(nw.x + nw.w, 300, 'the opposite corner stays put');
});

test('tool graphs: LoadImage → … → SaveImage at OUT, inputs wired', () => {
  const up = G.upscaleGraph('imagelab/a.png', 1000, 750, 2, '4x-UltraSharp.pth');
  assert.equal(up['1'].class_type, 'LoadImage');
  assert.equal(up['2'].inputs.model_name, '4x-UltraSharp.pth');
  assert.deepEqual([up['4'].inputs.width, up['4'].inputs.height], [2000, 1500]);
  assert.deepEqual(up[G.OUT].inputs.images, ['4', 0]);
  const plain = G.upscaleGraph('r', 101, 101, 1.5, null);
  assert.equal(plain['2'], undefined);
  assert.deepEqual(plain['4'].inputs.image, ['1', 0]);
  assert.equal(plain['4'].inputs.width % 2, 0);
  assert.equal(G.padGraph('r', { left: 61, top: 0, right: 64, bottom: 3 })['2'].inputs.left, 64);
  assert.equal(G.posterizeGraph('r', 999, 'none')['2'].inputs.colors, 256);
  assert.equal(G.cannyGraph('r', 0.6, 0.2)['2'].inputs.high_threshold, 0.6);
  assert.deepEqual(G.saveAsOutputGraph('r')[G.OUT].inputs.images, ['1', 0]);
});

test('upscale model pick: smallest that reaches the factor; scale read from the name', () => {
  assert.equal(G.modelScale('4x-UltraSharp.pth'), 4);
  assert.equal(G.modelScale('RealESRGAN_x2plus.pth'), 2);
  assert.equal(G.modelScale('2xNomosUni_span.safetensors'), 2);
  assert.equal(G.modelScale('mystery.pth'), 4);
  assert.equal(G.pickUpscaleModel(['4x-UltraSharp.pth', '2xNomosUni.pth'], 2), '2xNomosUni.pth');
  assert.equal(G.pickUpscaleModel(['2xNomosUni.pth'], 4), '2xNomosUni.pth');
  assert.equal(G.pickUpscaleModel([], 2), null);
});

test('preprocessor graph: defaults from object_info, image wired, resolution = long side', () => {
  const spec = { input: { required: { image: ['IMAGE'], coarse: [['disable', 'enable'], { default: 'disable' }] }, optional: { resolution: ['INT', { default: 512, min: 64, max: 16384 }] } } };
  const g = G.preprocessorGraph('r', 'LineArtPreprocessor', spec, 1216);
  assert.deepEqual(g['2'].inputs, { coarse: 'disable', resolution: 1216, image: ['1', 0] });
  const f = G.faceRestoreGraph('r', 'codeformer.pth', { input: { required: { facerestore_model: ['FACERESTORE_MODEL'], image: ['IMAGE'], facedetection: [['retinaface_resnet50', 'YOLOv5l']], codeformer_fidelity: ['FLOAT', { default: 0.5 }] } } }, 0.7);
  assert.equal(f['3'].inputs.facedetection, 'retinaface_resnet50');
  assert.equal(f['3'].inputs.codeformer_fidelity, 0.7);
  assert.deepEqual(f['3'].inputs.facerestore_model, ['2', 0]);
});

test('gpu view: fit centres in the free area; zoom keeps the point under the cursor', () => {
  const f = V.fitView(1000, 1000, 800, 600, { left: 80, top: 0, right: 0, bottom: 0 }, 0);
  assert.equal(f.z, 0.6);
  const c = V.toScreen(f, 800, 600, { x: 500, y: 500 });
  assert.deepEqual([Math.round(c.x), Math.round(c.y)], [440, 300]);
  const p = { x: 200, y: 100 };
  const before = V.toWorld(f, 800, 600, p);
  const z = V.zoomAt(f, 2, p, 800, 600, 0.1, 10);
  const after = V.toWorld(z, 800, 600, p);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(V.zoomAt(f, 100, p, 800, 600, 0.1, 1).z, 1);
  assert.equal(V.isFitted(f, f), true);
  assert.equal(V.isFitted(V.panBy(f, 5, 0), f), false);
});

const GS = require('./_load.cjs')('src/canvas/gpu/gesture.ts');

test('gesture: a press past 5 px pans (start does not follow the pointer), a still press is a tap', () => {
  const live = { x: 100, y: 100 };
  const d = GS.startDrag(1, live, true);
  live.x = 140; // the engine mutates its live pointer point: the drag must not see it
  assert.equal(d.start.x, 100);
  assert.equal(GS.moveDrag(d, { x: 102, y: 101 }), null, 'inside the slop');
  assert.deepEqual(GS.moveDrag(d, { x: 120, y: 100 }), { dx: 20, dy: 0 });
  assert.deepEqual(GS.moveDrag(d, { x: 125, y: 104 }), { dx: 5, dy: 4 });
  assert.equal(GS.isTap(d, false), false, 'a pan is never a tap');
  const t = GS.startDrag(2, { x: 0, y: 0 }, true);
  GS.moveDrag(t, { x: 3, y: 3 });
  assert.equal(GS.isTap(t, false), true);
  assert.equal(GS.isTap(t, true), false, 'cancelled');
  assert.equal(GS.isTap(GS.startDrag(3, { x: 0, y: 0 }, false), false), false, 'middle button');
});

test('gesture: the canvas leaves its own controls alone', () => {
  const el = (match) => ({ closest: (sel) => (sel.split(', ').some((s) => match(s)) ? {} : null) });
  assert.equal(GS.ignoredTarget(el((s) => s === 'button')), true);
  assert.equal(GS.ignoredTarget(el((s) => s === '[role="toolbar"]')), true);
  assert.equal(GS.ignoredTarget(el((s) => s === '[data-gpu-ignore]')), true);
  assert.equal(GS.ignoredTarget(el(() => false)), false, 'the canvas itself');
  assert.equal(GS.ignoredTarget(null), false);
});
