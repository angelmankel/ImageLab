// Starters (item 9): tags from the loaded prompts, the shape and search filters.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const S = load('src/screens/image/starters/starterLogic.ts');

test('promptTags: plain parts, weights and boilerplate stripped', () => {
  assert.deepEqual(S.promptTags('masterpiece, best quality, (neon rain:1.2), 1girl, <lora:x:0.8>, score_9, A Very Long Part With Many Words In It'), ['neon rain', '1girl']);
});

test('topTags: only tags in two or more prompts, most frequent first', () => {
  const t = S.topTags(['a cat, night, rain', 'night, rain, city', 'night, dog']);
  assert.deepEqual(t, [{ tag: 'night', count: 3 }, { tag: 'rain', count: 2 }]);
});

test('shapeOf and passes', () => {
  assert.equal(S.shapeOf(832, 1216), 'portrait');
  assert.equal(S.shapeOf(1216, 832), 'landscape');
  assert.equal(S.shapeOf(1024, 1024), 'square');
  const p = { prompt: 'a cat, (night:1.1), rain', width: 800, height: 1200 };
  assert.equal(S.passes(p, { tags: ['night'], query: 'cat', shape: 'portrait' }), true);
  assert.equal(S.passes(p, { tags: ['city'], query: '', shape: 'any' }), false);
  assert.equal(S.passes(p, { tags: [], query: '', shape: 'landscape' }), false);
  assert.equal(S.passes(p, { tags: [], query: 'dog', shape: 'any' }), false);
});
