const { test } = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./_load.cjs')('src/app/queueLogic.ts');

test('image jobs become rows with 0..1 progress; done/error jobs are dropped', () => {
  const r = Q.rowOfJob({ id: 'j1', status: 'running', createdAt: 5, progress: { value: 10, max: 40 }, node: 'KSampler', serverId: 's', positive: 'a cat' }, 'Pod', 'step-image');
  assert.equal(r.status, 'running');
  assert.equal(r.progress, 0.25);
  assert.equal(r.label, 'a cat');
  assert.equal(r.detail, 'Pod · KSampler');
  assert.equal(r.stepId, 'step-image');
  assert.equal(Q.rowOfJob({ id: 'j2', status: 'queued', createdAt: 1, serverId: 's' }).progress, undefined);
  assert.equal(Q.rowOfJob({ id: 'j3', status: 'error', createdAt: 1, serverId: 's' }), null);
  assert.equal(Q.rowOfJob({ id: 'j4', status: 'running', createdAt: 1, serverId: 's', progress: { value: 99, max: 40 } }).progress, 1);
});

test('runs: idle = no row; busy with nothing executing and others ahead = queued', () => {
  const idle = { busy: false, status: null, progress: null, currentNode: null, startedAt: null, queueRemaining: 0 };
  assert.equal(Q.rowOfRun('video', idle), null);
  const waiting = { ...idle, busy: true, queueRemaining: 2 };
  assert.equal(Q.rowOfRun('video', waiting).status, 'queued');
  const going = { ...idle, busy: true, currentNode: 'WanVideo', progress: 0.5, startedAt: 9 };
  const row = Q.rowOfRun('workflow', going, 'step-w');
  assert.equal(row.status, 'running');
  assert.equal(row.id, 'workflow-run');
  assert.equal(row.progress, 0.5);
  assert.equal(row.stepId, 'step-w');
});

test('order: running first, then queued, each oldest first', () => {
  const rows = [
    { id: 'q2', status: 'queued', startedAt: 20 }, { id: 'r2', status: 'running', startedAt: 15 },
    { id: 'q1', status: 'queued', startedAt: 10 }, { id: 'r1', status: 'running', startedAt: 5 },
  ];
  assert.deepEqual(Q.orderRows(rows).map((r) => r.id), ['r1', 'r2', 'q1', 'q2']);
});

test('runs with several queued prompts: one row each; ids parse back', () => {
  const run = { busy: true, status: 'Running', progress: 0.3, currentNode: 'KSampler', startedAt: 1, queueRemaining: 2,
    jobs: [{ promptId: 'p1', queuedAt: 1, running: true, progress: 0.3 }, { promptId: 'p2', queuedAt: 2, running: false, progress: null }] };
  const rows = Q.rowsOfRun('workflow', run, 'step-w');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'workflow-run:p1');
  assert.equal(rows[0].status, 'running');
  assert.equal(rows[0].progress, 0.3);
  assert.equal(rows[1].status, 'queued');
  assert.deepEqual(Q.parseRunRowId('workflow-run:p2'), { source: 'workflow', promptId: 'p2' });
  assert.deepEqual(Q.parseRunRowId('video-run'), { source: 'video', promptId: undefined });
  assert.equal(Q.parseRunRowId('abc'), null);
  assert.equal(Q.rowsOfRun('video', { ...run, busy: false }).length, 0);
  assert.equal(Q.rowsOfRun('video', { ...run, jobs: [] })[0].id, 'video-run');
});
