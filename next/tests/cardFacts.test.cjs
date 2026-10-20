// The selected-model card's "Creator's samples use" row (fix list item 16): typical settings read
// from the version's sample images, a LoRA's usual strength from the samples' civitaiResources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const F = load('src/screens/image/model/cardFacts.ts');

test('median / mode', () => {
  assert.equal(F.median([]), undefined);
  assert.equal(F.median([3, 1, 2]), 2);
  assert.equal(F.median([1, 2, 3, 4]), 2.5);
  assert.equal(F.mode(['a', 'b', 'b', 'a', 'b']), 'b');
  assert.equal(F.mode(['x', 'y']), 'x');
});

test('recommendFrom: median steps / CFG, most common sampler and clip skip', () => {
  const r = F.recommendFrom([
    { prompt: 'a', steps: 28, cfgScale: 5, sampler: 'Euler a', clipSkip: 2 },
    { prompt: 'b', steps: '30', cfgScale: 7, sampler: 'Euler a', 'Clip skip': '2' },
    { prompt: 'c', steps: 20, cfgScale: 6, sampler: 'DPM++ 2M Karras' },
    null,
  ]);
  assert.equal(r.steps, 28);
  assert.equal(r.cfg, 6);
  assert.equal(r.sampler, 'Euler a');
  assert.equal(r.clipSkip, 2);
  assert.equal(r.strength, undefined);
  assert.equal(r.from, 3);
  assert.equal(F.hasRecommended(r), true);
});

test('recommendFrom: strength from the resource that IS this version', () => {
  const res = (w, id) => ({ civitaiResources: [{ type: 'checkpoint', modelVersionId: 1 }, { type: 'lora', weight: w, modelVersionId: id }] });
  const r = F.recommendFrom([res(0.8, 42), res(0.7, 42), res(1, 99), res(0.9, 42)], 42);
  assert.equal(r.strength, 0.8);
  assert.equal(F.recommendFrom([res(0.8, 42)], null).strength, undefined);
});

test('recommendFrom: junk is ignored, nothing known → nothing shown', () => {
  const r = F.recommendFrom([{ steps: 0, cfgScale: 99, sampler: '  ' }, {}, undefined]);
  assert.deepEqual({ ...r }, { steps: undefined, cfg: undefined, sampler: undefined, clipSkip: undefined, strength: undefined, from: 0 });
  assert.equal(F.hasRecommended(r), false);
});

test('CFG rounds to halves', () => {
  assert.equal(F.recommendFrom([{ cfgScale: 4.2 }, { cfgScale: 4.4 }]).cfg, 4.5);
  assert.equal(F.fmtNum(0.8000001), '0.8');
});
