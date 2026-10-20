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
