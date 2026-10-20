// The ComfyUI screen's pure helpers (rule 14). Loads the real file: Node strips the types.
const test = require('node:test');
const assert = require('node:assert');
const h = require('../src/screens/comfy/comfyHelpers.ts');

const graphA = {
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sdxl/illustriousXL_v2.safetensors' } },
  '3': { class_type: 'KSampler', inputs: { seed: 8841, steps: 30, model: ['4', 0] }, _meta: { title: 'KSampler' } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'x' }, _meta: { title: 'Save Image' } },
};
const graphB = { '1': { class_type: 'SamplerCustom', inputs: { noise_seed: 12 } } };

test('queueRows: running first, pending in run order, labels and seeds', () => {
  const raw = {
    queue_running: [[5, 'run-1', graphA, {}, []]],
    queue_pending: [[9, 'p-late', graphB, {}, []], [7, 'p-early', {}, {}, []], ['bad'], [8, '', {}, {}, []]],
  };
  const rows = h.queueRows(raw, { 'p-late': 'Upscale step' });
  assert.deepEqual(rows.map((r) => [r.id, r.state]), [['run-1', 'running'], ['p-early', 'pending'], ['p-late', 'pending']]);
  assert.equal(rows[0].label, 'illustriousXL_v2');
  assert.equal(rows[0].seed, 8841);
  assert.equal(rows[1].label, 'Prompt #7');
  assert.equal(rows[1].seed, null);
  assert.equal(rows[2].label, 'Upscale step');
  assert.equal(rows[2].seed, 12);
  assert.deepEqual(h.queueRows(null), []);
  assert.deepEqual(h.queueRows({ queue_running: 'nope' }), []);
});

test('progress text, fraction and pending detail', () => {
  const [run] = h.queueRows({ queue_running: [[1, 'r', graphA]] });
  assert.equal(h.progressText(run, null), 'starting');
  assert.equal(h.progressText(run, { promptId: 'r', node: '3', value: 12, max: 30 }), 'KSampler · 12/30');
  assert.equal(h.progressText(run, { promptId: 'r', node: '4', value: 0, max: 0 }), 'CheckpointLoaderSimple');
  assert.equal(h.progressText(run, { promptId: 'other', node: '3', value: 1, max: 2 }), 'starting');
  assert.equal(h.progressFraction(run, { promptId: 'r', node: '3', value: 12, max: 30 }), 0.4);
  assert.equal(h.progressFraction(run, { promptId: 'r', node: '3', value: 50, max: 30 }), 1);
  assert.equal(h.pendingDetail({ ...run, seed: 8841 }, 1), '#1 in line · seed 8841');
  assert.equal(h.pendingDetail({ ...run, seed: null }, 2), '#2 in line');
});

test('nodeName', () => {
  assert.equal(h.nodeName(graphA, '9'), 'Save Image');
  assert.equal(h.nodeName(graphA, '4'), 'CheckpointLoaderSimple');
  assert.equal(h.nodeName(graphA, '77'), 'node 77');
  assert.equal(h.nodeName(null, null), '');
});

test('log lines from bus events', () => {
  const at = new Date(2026, 9, 19, 12, 4, 11).getTime();
  const g = () => graphA;
  assert.equal(h.clock(at), '12:04:11');
  assert.equal(h.logLine({ type: 'binary' }, at), null);
  assert.equal(h.logLine({ type: 'executing', promptId: 'p', node: null }, at), null);
  assert.equal(h.logLine({ type: 'execution_cached', promptId: 'p', nodes: [] }, at), null);
  assert.deepEqual(h.logLine({ type: 'execution_cached', promptId: 'p', nodes: ['1', '2'] }, at), { at, text: 'cached 2 nodes', tone: 'dim' });
  assert.equal(h.logLine({ type: 'execution_start', promptId: 'abcdef123456' }, at).text, 'got prompt abcdef12');
  assert.equal(h.logLine({ type: 'executing', promptId: 'p', node: '3' }, at, g).text, 'running KSampler');
  const p = h.logLine({ type: 'progress', promptId: 'p', node: '3', value: 12, max: 30 }, at, g);
  assert.equal(p.text, 'KSampler 12/30 · 40%');
  assert.equal(p.key, 'progress:p:3');
  assert.equal(h.logLine({ type: 'executed', promptId: 'p', node: '9', images: [{}, {}] }, at, g).text, 'Save Image saved 2 files');
  assert.equal(h.logLine({ type: 'execution_error', promptId: 'p', message: 'OOM' }, at).tone, 'err');
  assert.equal(h.logLine({ type: 'execution_success', promptId: 'p' }, at).tone, 'ok');
  assert.equal(h.logLine({ type: 'status', queueRemaining: 3 }, at).text, 'queue 3');
  assert.equal(h.logLine({ type: 'close' }, at).tone, 'warn');
});

test('appendLog collapses same-key runs and caps the length', () => {
  const l = (text, key) => ({ at: 0, text, tone: 'info', key });
  let lines = [];
  lines = h.appendLog(lines, l('got prompt'));
  lines = h.appendLog(lines, l('1/30', 'progress:p:3'));
  lines = h.appendLog(lines, l('2/30', 'progress:p:3'));
  lines = h.appendLog(lines, l('1/4', 'progress:p:7'));
  assert.deepEqual(lines.map((x) => x.text), ['got prompt', '2/30', '1/4']);
  let many = [];
  for (let i = 0; i < 10; i++) many = h.appendLog(many, l(String(i)), 4);
  assert.deepEqual(many.map((x) => x.text), ['6', '7', '8', '9']);
  assert.equal(h.logText([{ at: new Date(2026, 0, 1, 1, 2, 3).getTime(), text: 'hi', tone: 'dim' }]), '[01:02:03] hi');
});

test('system_stats → GPU, version, status line', () => {
  assert.equal(h.gpuName('cuda:0 NVIDIA B200 : cudaMallocAsync'), 'B200');
  assert.equal(h.gpuName('cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync'), 'RTX 4090');
  assert.equal(h.gpuName('cpu'), 'cpu');
  const s = h.readStats({ system: { comfyui_version: '0.3.75' }, devices: [{ name: 'cuda:0 NVIDIA B200 : native', vram_total: 80 * 1024 ** 3, vram_free: 60 * 1024 ** 3 }] });
  assert.deepEqual(s, { gpu: 'B200', vramTotal: 80 * 1024 ** 3, vramFree: 60 * 1024 ** 3, version: '0.3.75' });
  assert.equal(h.statusLine('This pod', s, true), 'This pod · B200 · ComfyUI 0.3.75');
  assert.equal(h.statusLine('This pod', null, true), 'This pod');
  assert.equal(h.statusLine('This pod', s, false), 'This pod · offline');
  assert.equal(h.vramText(s), '20.0 / 80.0 GB');
  assert.equal(h.vramText(null), '');
  assert.deepEqual(h.readStats(null), { gpu: null, vramTotal: 0, vramFree: 0, version: null });
});

test('workflow files', () => {
  assert.equal(h.workflowKind({ nodes: [], links: [] }), 'editor');
  assert.equal(h.workflowKind({ '1': { class_type: 'KSampler', inputs: {} } }), 'api');
  assert.equal(h.workflowKind({ '1': { inputs: {} } }), null);
  assert.equal(h.workflowKind([]), null);
  assert.equal(h.workflowKind({}), null);
  assert.equal(h.editorNodeCount({ nodes: [{ type: 'KSampler' }, { type: 'Note' }, { type: 'MarkdownNote' }, { type: 'SaveImage' }] }), 2);
  assert.equal(h.editorNodeCount({}), 0);
  assert.equal(h.workflowFileName('My flow (v2).json'), 'My flow (v2).json');
  assert.equal(h.workflowFileName('a/b:c.JSON'), 'a-b-c.json');
  assert.equal(h.workflowFileName('  .json'), 'workflow.json');
  assert.equal(h.epochMs(1700000000), 1700000000000);
  assert.equal(h.epochMs(1700000000000), 1700000000000);
  assert.equal(h.epochMs(0), 0);
});

test('ago and the workflow row detail', () => {
  const now = 1_000_000_000_000;
  assert.equal(h.ago(now - 10_000, now), 'just now');
  assert.equal(h.ago(now - 5 * 60_000, now), '5 min ago');
  assert.equal(h.ago(now - 3 * 3_600_000, now), '3 h ago');
  assert.equal(h.ago(now - 2 * 86_400_000, now), '2 d ago');
  assert.equal(h.ago(0, now), '');
  assert.equal(h.workflowDetail(12, now - 120_000, now - 86_400_000 * 3, now), '12 nodes · used 2 min ago');
  assert.equal(h.workflowDetail(1, 0, now - 86_400_000 * 3, now), '1 node · saved 3 d ago');
  assert.equal(h.workflowDetail(null, 0, 0, now), '');
});
