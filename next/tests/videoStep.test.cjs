const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/screens/image/video/videoStepLogic.ts');

test('sides snap to the engine grid', () => {
  assert.equal(L.snapSide('wan', 833), 832);
  assert.equal(L.snapSide('wan', 0), 16);
  assert.equal(L.snapSide('h3', 870), 864);
  assert.equal(L.snapSide('h3', 1), 32);
  assert.equal(L.sideStep('wan'), 16);
  assert.equal(L.sideStep('h3'), 32);
});

test('frames snap to 4n+1 (Wan) and 17n+5 (H3)', () => {
  assert.equal(L.snapFrames('wan', 80), 81);
  assert.equal(L.snapFrames('wan', 1), 5);
  assert.equal(L.snapFrames('h3', 120), 124);
  assert.equal(L.snapFrames('h3', 5), 5);
  assert.equal(L.snapFrames('h3', 6), 22);
});

test('fps and seconds', () => {
  assert.equal(L.fpsOf('h3', 16), 24);
  assert.equal(L.fpsOf('wan', 16), 16);
  assert.equal(L.secondsOf(81, 16), 5.1);
  assert.equal(L.secondsOf(124, 24), 5.2);
  assert.equal(L.framesForSeconds('wan', 5, 16), 81);
  assert.equal(L.framesForSeconds('h3', 5, 24), 124);
  const chips = L.lengthChips('wan', 16);
  assert.deepEqual(chips.map((c) => c.frames), [33, 49, 81, 121]);
  assert.equal(chips[2].seconds, 5.1);
  assert.deepEqual(L.lengthChips('h3', 24).map((c) => c.frames), [73, 124, 243, 362]);
});

test('size presets are on the grid', () => {
  for (const g of L.SIZE_PRESETS.wan) for (const s of g.items) { assert.equal(s.width % 16, 0); assert.equal(s.height % 16, 0); }
  for (const g of L.SIZE_PRESETS.h3) for (const s of g.items) { assert.equal(s.width % 32, 0); assert.equal(s.height % 32, 0); }
});

test('a portrait picture flips a landscape size, and only then', () => {
  assert.deepEqual(L.fitOrientation({ width: 832, height: 480 }, { width: 600, height: 900 }), { width: 480, height: 832 });
  assert.deepEqual(L.fitOrientation({ width: 832, height: 480 }, { width: 900, height: 600 }), { width: 832, height: 480 });
  assert.deepEqual(L.fitOrientation({ width: 624, height: 624 }, { width: 600, height: 900 }), { width: 624, height: 624 });
  assert.deepEqual(L.fitOrientation({ width: 832, height: 480 }, { width: 500, height: 500 }), { width: 832, height: 480 });
  assert.deepEqual(L.fitOrientation({ width: 832, height: 480 }, null), { width: 832, height: 480 });
});

test('tasks and fields per engine', () => {
  assert.deepEqual(L.tasksFor('wan').map((t) => t.key), ['t2v', 'i2v']);
  assert.deepEqual(L.tasksFor('h3').map((t) => t.key), ['t2v', 'i2v', 'ref']);
  const w = L.visibleFields('wan', 'i2v');
  assert.equal(w.startFrame, true); assert.equal(w.endFrame, true); assert.equal(w.refs, false); assert.equal(w.fast, true); assert.equal(w.turbo, false); assert.equal(w.fps, true);
  const t = L.visibleFields('wan', 't2v');
  assert.equal(t.startFrame, false); assert.equal(t.colorMatch, false);
  const h = L.visibleFields('h3', 'ref');
  assert.equal(h.refs, true); assert.equal(h.turbo, true); assert.equal(h.fast, false); assert.equal(h.audio, true); assert.equal(h.fps, false);
});

test('the start frame resolves: chained wins, then the own picture', () => {
  const prev = { url: 'http://x/view?f=a.png', name: 'a.png' };
  assert.deepEqual(L.resolveStart({ chained: true, hasPrev: true, prev, startImage: 'imagelab/old.png' }), { source: 'prev', prev });
  assert.deepEqual(L.resolveStart({ chained: true, hasPrev: true, prev: null, startImage: 'imagelab/old.png' }), { source: 'none' });
  assert.deepEqual(L.resolveStart({ chained: true, hasPrev: false, prev: null, startImage: 'imagelab/old.png' }), { source: 'own', ref: 'imagelab/old.png' });
  assert.deepEqual(L.resolveStart({ chained: false, hasPrev: true, prev, startImage: 'imagelab/old.png' }), { source: 'own', ref: 'imagelab/old.png' });
  assert.deepEqual(L.resolveStart({ chained: false, hasPrev: true, prev, startImage: '' }), { source: 'none' });
});

test('why Generate is off', () => {
  const base = { host: 'pod/video-comfy', task: 'i2v', chained: true, hasPrev: true, prevIndex: 0, prevHasOutput: true, prompt: 'the cat turns', startImage: '', refs: 0 };
  assert.equal(L.blockReason(base), null);
  assert.equal(L.blockReason({ ...base, host: null }), 'No video server');
  assert.equal(L.blockReason({ ...base, prevHasOutput: false }), 'Step 1 has no image yet');
  assert.equal(L.blockReason({ ...base, prompt: '  ' }), 'Write a motion prompt first');
  assert.equal(L.blockReason({ ...base, chained: false }), 'Pick a start picture in Input');
  assert.equal(L.blockReason({ ...base, chained: false, startImage: 'imagelab/x.png' }), null);
  assert.equal(L.blockReason({ ...base, task: 't2v', chained: false }), null);
  assert.equal(L.blockReason({ ...base, task: 't2v', prevHasOutput: false }), null);
  assert.equal(L.blockReason({ ...base, task: 'ref', chained: false }), 'Add a reference picture in Input');
  assert.equal(L.blockReason({ ...base, task: 'ref', chained: false, refs: 2 }), null);
});

test('file helpers', () => {
  assert.equal(L.shortFile('imagelab/1234-cat.png'), '1234-cat');
  assert.equal(L.shortFile('wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors'), 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise');
  const files = ['a.safetensors', 'wan2.2_i2v_animestyle_v2_high.safetensors', 'minimax_h3_fl2v_turbo_8step.safetensors', 'smoothMixWan2214BI2V_t2vHighV40.safetensors'];
  assert.deepEqual(L.filesForEngine(files, 'wan').fit, ['wan2.2_i2v_animestyle_v2_high.safetensors', 'smoothMixWan2214BI2V_t2vHighV40.safetensors']);
  assert.deepEqual(L.filesForEngine(files, 'h3').fit, ['minimax_h3_fl2v_turbo_8step.safetensors']);
  assert.deepEqual(L.filesForEngine(files, 'h3').rest.length, 3);
  assert.equal(L.speedLabel('wan', true, 4), 'Fast · 4 steps');
  assert.equal(L.speedLabel('h3', false, 20), 'Full · 20 steps');
});
