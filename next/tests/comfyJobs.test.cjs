// FIXLIST-2 #51: prompts queued inside the embedded ComfyUI show in our Jobs list.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const J = load('src/screens/comfy/comfyJobsLogic.ts');

const graph = { 3: { class_type: 'KSampler', _meta: { title: 'Sampler A' } }, 9: { class_type: 'SaveImage' } };
const raw = {
  queue_running: [[5, 'p-run', graph, { client_id: 'frame' }, []]],
  queue_pending: [[8, 'p-b', {}, { client_id: 'frame' }, []], [7, 'p-a', {}, {}, []], [6, 'p-ours', {}, { client_id: 'me' }, []], [9, 'p-known', {}, { client_id: 'other' }, []]],
};

test('foreign prompts: not our client id, not a known prompt; running first then run order', () => {
  const items = J.foreignItems(raw, 'me', new Set(['p-known']));
  assert.deepEqual(items.map((i) => [i.promptId, i.state]), [['p-run', 'running'], ['p-a', 'queued'], ['p-b', 'queued']]);
  assert.deepEqual(J.foreignItems(null, 'me'), []);
});

test('rows: ComfyUI label, server · node · steps, progress from live', () => {
  const items = J.foreignItems(raw, 'me');
  const rows = J.foreignRows('pod:8188', 'This pod', items, { promptId: 'p-run', node: '3', value: 12, max: 20 }, { 'p-run': 100 });
  assert.equal(rows[0].label, 'ComfyUI');
  assert.equal(rows[0].source, 'comfy');
  assert.equal(rows[0].status, 'running');
  assert.equal(rows[0].progress, 0.6);
  assert.equal(rows[0].detail, 'This pod · Sampler A · 12/20');
  assert.equal(rows[0].startedAt, 100);
  assert.equal(rows[1].status, 'queued');
  assert.equal(rows[1].progress, undefined);
  assert.equal(rows[1].detail, 'This pod');
});

test('row ids round-trip, hosts with paths too', () => {
  const id = J.comfyRowId('pod.example/video-comfy', 'abc-1');
  assert.deepEqual(J.parseComfyRowId(id), { host: 'pod.example/video-comfy', promptId: 'abc-1' });
  assert.equal(J.parseComfyRowId('video-run'), null);
});

test('node names and chip text', () => {
  assert.equal(J.graphNodeName(graph, '9'), 'SaveImage');
  assert.equal(J.graphNodeName(graph, '44'), 'node 44');
  assert.equal(J.chipText('KSampler', { promptId: 'x', node: '3', value: 5, max: 20 }, 2), 'KSampler · 5/20 · 25% · 2 queued');
  assert.equal(J.chipText('', null, 0), 'Running…');
  assert.equal(J.liveFraction({ promptId: 'x', node: null, value: 1, max: 0 }, 'x'), undefined);
});
