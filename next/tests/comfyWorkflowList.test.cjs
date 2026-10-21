// FIXLIST-2 #53: the ComfyUI workflows list rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const L = load('src/screens/comfy/workflowListLogic.ts');

const wf = (...types) => ({ nodes: types.map((type, i) => ({ id: i, type })) });

test('type badge from the nodes, subgraphs included', () => {
  assert.equal(L.workflowType(wf('CheckpointLoaderSimple', 'EmptyLatentImage', 'KSampler', 'SaveImage')), 'image');
  assert.equal(L.workflowType(wf('UNETLoader', 'WanImageToVideo', 'KSamplerAdvanced', 'SaveVideo')), 'video');
  assert.equal(L.workflowType(wf('LoadImage', 'UpscaleModelLoader', 'ImageUpscaleWithModel', 'SaveImage')), 'upscale');
  assert.equal(L.workflowType(wf('EmptyLatentImage', 'KSampler', 'UpscaleModelLoader', 'ImageUpscaleWithModel', 'SaveImage')), 'image');
  assert.equal(L.workflowType(wf('Note')), 'other');
  assert.equal(L.workflowType({}), 'other');
  assert.equal(L.workflowType({ nodes: [{ type: 'abc-uuid' }], definitions: { subgraphs: [{ nodes: [{ type: 'VHS_VideoCombine' }] }] } }), 'video');
});

test('short meta', () => {
  const now = 10_000_000_000;
  assert.equal(L.rowMeta(9, now - 60_000, 0, now), '9 nodes · 1m');
  assert.equal(L.rowMeta(1, 0, now - 3 * 3600_000, now), '1 node · 3h');
  assert.equal(L.rowMeta(9, now - 1000, 0, now, true), '9 · now');
  assert.equal(L.rowMeta(null, 0, 0, now), '');
  assert.equal(L.shortAgo(now - 20 * 86400_000, now), '3w');
});

test('search and sort', () => {
  const rows = [
    { name: 'b10', path: 'b10.json', usedAt: 0, savedAt: 5 },
    { name: 'b2', path: 'wip/b2.json', usedAt: 9, savedAt: 1 },
    { name: 'A', path: 'A.json', usedAt: 0, savedAt: 7 },
  ];
  assert.deepEqual(L.shownRows(rows, '', 'recent').map((r) => r.name), ['b2', 'A', 'b10']);
  assert.deepEqual(L.shownRows(rows, '', 'name').map((r) => r.name), ['A', 'b2', 'b10']);
  assert.deepEqual(L.shownRows(rows, 'wip b', 'name').map((r) => r.name), ['b2']);
});

test('copy and rename paths stay in the folder', () => {
  assert.deepEqual(L.copyNames('wip/a.json', 2), ['wip/a (copy).json', 'wip/a (copy 2).json']);
  assert.equal(L.renamedPath('wip/a.json', ' b/c '), 'wip/b-c.json');
  assert.equal(L.renamedPath('a.json', 'a'), null);
  assert.equal(L.renamedPath('a.json', '  '), null);
});
