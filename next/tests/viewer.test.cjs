// Item 30, the viewer's pure parts: slideshow transitions (src/screens/viewer/slideshowLogic.ts)
// and the Details tab's reading of a history entry (metaLogic.ts).
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/screens/viewer/slideshowLogic.ts');
const M = require('../src/screens/viewer/metaLogic.ts');

test('every transition has frames for both sides (cut has none) and reduced motion is a short fade', () => {
  for (const t of S.SHOW_TRANSITIONS) {
    const f = S.transitionFrames(t.id);
    if (t.id === 'cut') { assert.equal(f.ms, 0); continue; }
    assert.ok(f.ms >= 600, t.id);
    assert.equal(f.incoming.length, 2); assert.equal(f.outgoing.length, 2);
    assert.equal(f.incoming[1].opacity, 1, `${t.id} lands opaque`);
  }
  assert.equal(S.transitionFrames('slide', 1, true).ms, 200);
});

test('slide goes the asked way', () => {
  assert.match(S.transitionFrames('slide', 1).incoming[0].transform, /translateX\(100%\)/);
  assert.match(S.transitionFrames('slide', -1).incoming[0].transform, /translateX\(-100%\)/);
});

test('ken burns: neighbours drift differently; next index wraps', () => {
  assert.notDeepEqual(S.kenBurnsFrames(0), S.kenBurnsFrames(1));
  assert.equal(S.nextShowIndex(4, 5), 0);
  assert.equal(S.nextShowIndex(0, 0), 0);
  assert.ok(S.isShowTransition('blur')); assert.ok(!S.isShowTransition('fade'));
});

test('formatDuration / shortName', () => {
  assert.equal(M.formatDuration(8400), '8.4 s');
  assert.equal(M.formatDuration(72000), '1 m 12 s');
  assert.equal(M.formatDuration(120000), '2 m');
  assert.equal(M.formatDuration(undefined), null);
  assert.equal(M.shortName('sdxl/wai_v140.safetensors'), 'wai_v140');
});

const wf = {
  inputImage: null, inputDenoise: 0.55, steps: 28, cfg: 5.5, sampler: 'euler_ancestral', scheduler: 'karras', width: 832, height: 1216,
  batch: 1, clipSkip: -2, loopback: { enabled: true, iterations: 2, upscale: 1.25 }, vae: '', modelProfile: 'illustrious',
  checkpoints: [{ id: 'a', name: 'wai.safetensors', ratio: 0.5 }, { id: 'b', name: 'x/other.ckpt', ratio: 0.3 }],
  loras: [{ id: 'l', name: 'detail.safetensors', strength: 0.6, clipStrength: 1, on: true }, { id: 'm', name: 'off', strength: 1, clipStrength: 1, on: false }],
  embeddings: [{ id: 'e', name: 'easyneg', target: 'negative', strength: 1, on: true }],
};

test('describeEntry: models, the params that apply, img2img only with an input', () => {
  const m = M.describeEntry({ positive: 'a cat', negative: 'blurry', seed: 42, model: 'wai.safetensors', workflow: wf });
  assert.deepEqual(m.checkpoints.map((c) => [c.name, c.role]), [['wai', 'Checkpoint'], ['other', 'Merged · 30%']]);
  assert.deepEqual(m.loras.map((l) => [l.name, l.strength]), [['detail', 0.6]]);
  assert.equal(m.embeddings[0].role, 'Embedding · negative');
  const p = Object.fromEntries(m.params.map((r) => [r.label, r.value]));
  assert.deepEqual(p, { Seed: '42', Steps: '28', CFG: '5.5', Sampler: 'euler_ancestral', Scheduler: 'karras', Size: '832×1216', 'Clip skip': '2', Loopback: '2 × 1.25' });
  assert.equal(m.img2img, false);
  const i = M.describeEntry({ positive: '', negative: '', seed: 1, model: '', workflow: { ...wf, inputImage: { dataUrl: '', name: 'x', width: 1, height: 1 } } });
  assert.ok(i.params.some((r) => r.label === 'Denoise' && r.value === '0.55'));
});

test('describeEntry without a workflow snapshot: model + seed only', () => {
  const m = M.describeEntry({ positive: 'p', negative: '', seed: 7, model: 'm.safetensors' });
  assert.deepEqual(m.checkpoints.map((c) => c.name), ['m']);
  assert.deepEqual(m.params, [{ label: 'Seed', value: '7', mono: true }]);
});
