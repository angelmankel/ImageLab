const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./_load.cjs')('src/app/jobProgressLogic.ts');

const base = { rows: [], stepIds: ['a', 'b'], flash: null, offline: false, downloads: 0, downloadPercent: null };
const run = (id, stepId, progress, startedAt = 1) => ({ id, stepId, source: 'image', label: 'x', status: 'running', progress, startedAt });
const wait = (id) => ({ id, source: 'image', label: 'x', status: 'queued', startedAt: 2 });

test('running: percent, step (only with several steps), queued count', () => {
  const p = P.jobProgressOf({ ...base, rows: [run('j', 'b', 0.42), wait('q1'), wait('q2')] });
  assert.equal(p.state, 'running');
  assert.equal(p.percent, 42);
  assert.equal(p.stepIndex, 2);
  assert.equal(p.queued, 2);
  assert.equal(p.label, '42% · step 2 · 2 queued');
  assert.equal(P.tabTitleOf(p), '▶ 42% · step 2 · 2 queued · ImageLab');
  const one = P.jobProgressOf({ ...base, stepIds: ['a'], rows: [run('j', 'a', undefined)] });
  assert.equal(one.label, 'Running');
});

test('order: queued, then a latched flash, then offline, then idle / downloads', () => {
  assert.equal(P.tabTitleOf(P.jobProgressOf({ ...base, rows: [wait('q')] })), '⏳ 1 queued · ImageLab');
  assert.equal(P.tabTitleOf(P.jobProgressOf({ ...base, flash: 'done', offline: true })), '✓ Done · ImageLab');
  assert.equal(P.tabTitleOf(P.jobProgressOf({ ...base, flash: 'error' })), '⚠ Error · ImageLab');
  assert.equal(P.tabTitleOf(P.jobProgressOf({ ...base, offline: true })), '⚠ Offline · ImageLab');
  assert.equal(P.tabTitleOf(P.jobProgressOf(base)), 'ImageLab');
  assert.equal(P.tabTitleOf(P.jobProgressOf({ ...base, downloads: 2, downloadPercent: 36.6 })), '↓ 37% · ImageLab');
});

test('favicon: none when idle, a ring otherwise; sameProgress spots no change', () => {
  assert.equal(P.faviconHrefOf(P.jobProgressOf(base)), null);
  const p = P.jobProgressOf({ ...base, rows: [run('j', 'a', 0.5)] });
  assert.match(P.faviconSvgOf(p), /stroke-dasharray/);
  assert.ok(P.sameProgress(p, P.jobProgressOf({ ...base, rows: [run('j', 'a', 0.5)] })));
  assert.ok(!P.sameProgress(p, P.jobProgressOf({ ...base, rows: [run('j', 'a', 0.6)] })));
});
