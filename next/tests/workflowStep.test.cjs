const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/screens/image/workflow/workflowStepLogic.ts');

const P = (over) => ({ id: '1:x', nodeId: 1, nodeLabel: 'Node', nodeType: 'KSampler', name: 'x', type: 'INT', value: 0, default: 0, multiline: false, seedLike: false, ...over });

test('classify: prompt target, image, loader, seed, number, combo, bool, string', () => {
  const text = P({ id: '4:text', nodeId: 4, nodeType: 'CLIPTextEncode', name: 'text', type: 'STRING', multiline: true, value: 'a fox' });
  assert.equal(L.classify(text, '4:text'), 'prompt');
  assert.equal(L.classify(text, null), 'string');
  assert.equal(L.classify(P({ nodeType: 'LoadImage', name: 'image', type: 'COMBO', options: ['a.png'] }), null), 'image');
  assert.equal(L.classify(P({ nodeType: 'CheckpointLoaderSimple', name: 'ckpt_name', type: 'COMBO', options: ['wai.safetensors'] }), null), 'loader');
  assert.equal(L.classify(P({ nodeType: 'UpscaleModelLoader', name: 'model_name', type: 'COMBO', options: ['4x-AnimeSharp.pth'] }), null), 'loader');
  // A loader node whose list is empty is still a loader (nothing installed), a sampler list is a combo.
  assert.equal(L.classify(P({ nodeType: 'LoraLoader', name: 'lora_name', type: 'COMBO', options: [] }), null), 'loader');
  assert.equal(L.classify(P({ name: 'sampler_name', type: 'COMBO', options: ['euler', 'dpmpp_2m'] }), null), 'combo');
  assert.equal(L.classify(P({ name: 'seed', seedLike: true }), null), 'seed');
  assert.equal(L.classify(P({ name: 'noise_seed', seedLike: true, type: 'FLOAT' }), null), 'number');
  assert.equal(L.classify(P({ name: 'cfg', type: 'FLOAT' }), null), 'number');
  assert.equal(L.classify(P({ name: 'add_noise', type: 'BOOLEAN' }), null), 'bool');
  assert.equal(L.classify(P({ name: 'filename_prefix', type: 'STRING' }), null), 'string');
});

test('loaders: pick kind, label, status, file label', () => {
  assert.equal(L.loaderPickKind({ name: 'ckpt_name', nodeType: 'CheckpointLoaderSimple' }), 'checkpoint');
  assert.equal(L.loaderPickKind({ name: 'unet_name', nodeType: 'UNETLoader' }), 'checkpoint');
  assert.equal(L.loaderPickKind({ name: 'lora_name', nodeType: 'LoraLoaderModelOnly' }), 'lora');
  assert.equal(L.loaderPickKind({ name: 'vae_name', nodeType: 'VAELoader' }), 'vae');
  assert.equal(L.loaderPickKind({ name: 'control_net_name', nodeType: 'ControlNetLoader' }), 'controlnet');
  assert.equal(L.loaderPickKind({ name: 'model_name', nodeType: 'UpscaleModelLoader' }), 'upscale');
  assert.equal(L.loaderPickKind({ name: 'clip_name1', nodeType: 'DualCLIPLoader' }), null);
  assert.equal(L.loaderLabel({ name: 'clip_name2', nodeType: 'DualCLIPLoader' }), 'CLIP 2');
  assert.equal(L.loaderLabel({ name: 'unet_name', nodeType: 'UNETLoader' }), 'Diffusion model');
  assert.equal(L.loaderLabel({ name: 'ipadapter_file', nodeType: 'IPAdapterModelLoader' }), 'IP-Adapter');
  assert.equal(L.loaderLabel({ name: 'some_thing', nodeType: 'X' }), 'some thing');
  assert.equal(L.loaderStatus({ options: ['a.safetensors', 'b.safetensors'] }, 'a.safetensors'), 'ok');
  assert.equal(L.loaderStatus({ options: ['a.safetensors'] }, 'flux1-dev.safetensors'), 'missing');
  assert.equal(L.loaderStatus({ options: [] }, 'x'), 'none');
  assert.equal(L.fileLabel('sdxl/wai-illustrious-sdxl.safetensors'), 'wai-illustrious-sdxl');
  assert.equal(L.fileLabel('4x-AnimeSharp.pth'), '4x-AnimeSharp');
  assert.equal(L.fileLabel(''), '—');
});

test('grouping by node keeps graph order; pinned keeps pin order and drops stale ids', () => {
  const a1 = P({ id: '1:a', nodeId: 1, nodeLabel: 'Sampler', name: 'a' });
  const a2 = P({ id: '1:b', nodeId: 1, nodeLabel: 'Sampler', name: 'b' });
  const b1 = P({ id: '2:c', nodeId: 2, nodeLabel: 'Size', name: 'c' });
  const groups = L.groupByNode([a1, a2, b1]);
  assert.deepEqual(groups.map((g) => [g.label, g.items.length]), [['Sampler', 2], ['Size', 1]]);
  assert.deepEqual(L.pinnedFirst([a1, a2, b1], ['2:c', 'gone', '1:a']).map((p) => p.id), ['2:c', '1:a']);
});

test('numberRange: sane narrowing, slider vs box, the saved value never falls out', () => {
  const steps = L.numberRange({ name: 'steps', type: 'INT', value: 30, min: 1, max: 10000, step: 1 });
  assert.deepEqual(steps, { min: 1, max: 100, step: 1, slider: true });
  const big = L.numberRange({ name: 'steps', type: 'INT', value: 150, min: 1, max: 10000, step: 1 });
  assert.equal(big.max, 150);
  const length = L.numberRange({ name: 'length', type: 'INT', value: 81, min: 1, max: 16384, step: 4 });
  assert.equal(length.slider, false);
  const shift = L.numberRange({ name: 'shift', type: 'FLOAT', value: 3.1 });
  assert.equal(shift.slider, true); // a well-known name gets a range even when the node declares none
  const unknown = L.numberRange({ name: 'quality', type: 'INT', value: 90 });
  assert.equal(unknown.slider, false);
  const cfg = L.numberRange({ name: 'cfg', type: 'FLOAT', value: 5.5, min: 0, max: 100, step: 0.1 });
  assert.deepEqual([cfg.min, cfg.max, cfg.step], [1, 20, 0.1]);
});

test('presets stay inside the range; numbers format by step', () => {
  assert.deepEqual(L.presetsFor({ name: 'steps' }, { min: 1, max: 25 }), [8, 20]);
  assert.equal(L.presetsFor({ name: 'steps' }, { min: 1, max: 10 }), undefined);
  assert.equal(L.presetsFor({ name: 'tile_width' }, { min: 0, max: 9999 }), undefined);
  assert.equal(L.formatNumber(5.5, { type: 'FLOAT', step: 0.1 }), '5.5');
  assert.equal(L.formatNumber(0.6000000000000001, { type: 'FLOAT', step: 0.05 }), '0.6');
  assert.equal(L.formatNumber(1, { type: 'FLOAT', step: 0.05 }), '1');
  assert.equal(L.formatNumber(0.001, { type: 'FLOAT', step: 0.001 }), '0.001');
  assert.equal(L.formatNumber(29.6, { type: 'INT' }), '30');
  assert.equal(L.formatNumber('abc', { type: 'INT' }), 'abc');
});

test('seedIdsToReroll: the dice rolls every seed, Generate only the ones not kept', () => {
  const s1 = P({ id: '7:seed', name: 'seed', seedLike: true });
  const s2 = P({ id: '12:noise_seed', name: 'noise_seed', seedLike: true });
  const n = P({ id: '7:steps', name: 'steps' });
  assert.deepEqual(L.seedIdsToReroll([s1, s2, n], ['7:seed'], false), ['12:noise_seed']);
  assert.deepEqual(L.seedIdsToReroll([s1, s2, n], ['7:seed'], true), ['7:seed', '12:noise_seed']);
  assert.deepEqual(L.seedIdsToReroll([n], [], true), []);
});

test('chainInputFrom: the resolved step input into the LoadImage; no LoadImage = none', () => {
  const prev = { url: 'http://pod/view?f=1', name: '1.png' };
  assert.deepEqual(L.chainInputFrom({ kind: 'chained', src: prev }, false), { kind: 'none' });
  assert.deepEqual(L.chainInputFrom({ kind: 'chained', src: prev }, true), { kind: 'chained', src: prev });
  assert.deepEqual(L.chainInputFrom({ kind: 'waiting' }, true), { kind: 'waiting' });
  assert.deepEqual(L.chainInputFrom({ kind: 'none' }, true), { kind: 'none' });
  assert.deepEqual(L.chainInputFrom(null, true), { kind: 'none' });
  const mine = { url: 'data:x', name: 'mine.png' };
  assert.deepEqual(L.chainInputFrom({ kind: 'explicit', src: mine }, true), { kind: 'explicit', src: mine });
});

test('workflow list grouping: root first, folders after, names sorted naturally', () => {
  const rows = [
    { path: 'TagForce/Wan VACE.json', name: 'Wan VACE' },
    { path: 'Z-Image Turbo.json', name: 'Z-Image Turbo' },
    { path: 'Anima Turbo.json', name: 'Anima Turbo' },
    { path: 'TagForce/FLUX.2 redraw (8 steps).json', name: 'FLUX.2 redraw (8 steps)' },
    { path: 'TagForce/FLUX.2 redraw (30 steps).json', name: 'FLUX.2 redraw (30 steps)' },
    { path: 'Archive/old.json', name: 'old' },
  ];
  const g = L.groupWorkflows(rows);
  assert.deepEqual(g.map((x) => x.folder), ['', 'Archive', 'TagForce']);
  assert.deepEqual(g[0].items.map((w) => w.name), ['Anima Turbo', 'Z-Image Turbo']);
  assert.deepEqual(g[2].items.map((w) => w.name), ['FLUX.2 redraw (8 steps)', 'FLUX.2 redraw (30 steps)', 'Wan VACE']);
  assert.equal(L.workflowName('TagForce/Wan VACE walk.json'), 'Wan VACE walk');
  assert.equal(L.uploadName('my photo (1).png', 5), '5-my-photo-1-.png');
  assert.equal(L.uploadName('', 5), '5-image.png');
});
