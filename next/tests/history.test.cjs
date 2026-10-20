const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_load.cjs')('src/screens/image/historyLogic.ts');
const A = require('./_load.cjs')('src/app/actions.ts');

const img = (k, t, liked) => ({ key: k, url: `u${k}`, kind: 'image', filename: `${k}.png`, createdAt: t, entry: { id: k, liked } });
const vid = (k, t) => ({ key: k, url: `u${k}`, kind: 'video', filename: `${k}.mp4`, createdAt: t });

test('merge newest first, with likes from the entry', () => {
  const tiles = H.mergeTiles([img('a', 1, true), img('b', 3)], [vid('v', 2)]);
  assert.deepEqual(tiles.map((t) => t.key), ['b', 'v', 'a']);
  assert.equal(tiles[2].liked, true);
  assert.equal(tiles[1].entry, null);
});

test('filters', () => {
  const tiles = H.mergeTiles([img('a', 1, true), img('b', 3)], [vid('v', 2)]);
  assert.deepEqual(H.filterTiles(tiles, 'images').map((t) => t.key), ['b', 'a']);
  assert.deepEqual(H.filterTiles(tiles, 'videos').map((t) => t.key), ['v']);
  assert.deepEqual(H.filterTiles(tiles, 'liked').map((t) => t.key), ['a']);
  assert.equal(H.filterTiles(tiles, 'all').length, 3);
});

test('CivitAI sampler names map to ComfyUI samplers + schedulers', () => {
  const samplers = ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde'];
  const schedulers = ['normal', 'karras', 'exponential'];
  assert.deepEqual(A.samplerOf('DPM++ 2M Karras', samplers, schedulers), { sampler: 'dpmpp_2m', scheduler: 'karras' });
  assert.deepEqual(A.samplerOf('Euler a', samplers, schedulers), { sampler: 'euler_ancestral', scheduler: undefined });
  assert.deepEqual(A.samplerOf('DPM++ 2M SDE', samplers, schedulers), { sampler: 'dpmpp_2m_sde', scheduler: undefined });
  assert.deepEqual(A.samplerOf('Euler', samplers, schedulers), { sampler: 'euler', scheduler: undefined });
});

test('This step: tagged tiles go to their step, untagged ones to the first step of their kind', () => {
  const steps = [{ id: 's1', kind: 'image' }, { id: 's2', kind: 'image' }, { id: 'v1', kind: 'video' }];
  const tags = { b: 's2', gone: 'removed' };
  assert.equal(H.inStep({ key: 'b', source: 'image' }, steps[1], steps, tags), true);
  assert.equal(H.inStep({ key: 'b', source: 'image' }, steps[0], steps, tags), false);
  assert.equal(H.inStep({ key: 'a', source: 'image' }, steps[0], steps, tags), true);
  assert.equal(H.inStep({ key: 'a', source: 'image' }, steps[1], steps, tags), false);
  assert.equal(H.inStep({ key: 'gone', source: 'image' }, steps[0], steps, tags), true);
  assert.equal(H.inStep({ key: 'c', source: 'video' }, steps[2], steps, tags), true);
  assert.equal(H.inStep({ key: 'c', source: 'workflow' }, steps[0], steps, tags), true);
  assert.equal(H.inStep({ key: 'c', source: 'workflow' }, steps[0], [...steps, { id: 'w1', kind: 'workflow' }], tags), false);
});

test('a new result is credited to the active step when it makes that kind', () => {
  const steps = [{ id: 's1', kind: 'image' }, { id: 's2', kind: 'image' }, { id: 'v1', kind: 'video' }];
  assert.equal(H.creditStep('image', 's2', steps), 's2');
  assert.equal(H.creditStep('image', 'v1', steps), 's1');
  assert.equal(H.creditStep('video', 's1', steps), 'v1');
  assert.equal(H.creditStep('workflow', 's1', steps), 's1');
  assert.equal(H.creditStep('workflow', 'v1', steps), 's1');
});
