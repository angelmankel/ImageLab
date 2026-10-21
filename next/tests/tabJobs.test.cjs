const { test } = require('node:test');
const assert = require('node:assert/strict');
const J = require('./_load.cjs')('src/screens/image/topbar/tabJobs.ts');

test('jobsBySession: by sessionId, else by the step that queued it', () => {
  const sessions = [{ id: 'A', steps: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'B', steps: [{ id: 'b1' }] }];
  const r = J.jobsBySession([
    { stepId: 'a2', status: 'running', progress: 0.4 },
    { stepId: 'a1', status: 'queued' },
    { stepId: 'zz', sessionId: 'B', status: 'queued' },
    { stepId: 'nope', status: 'queued' },
  ], sessions);
  assert.deepEqual(r.A, { running: true, progress: 0.4, count: 2 });
  assert.deepEqual(r.B, { running: false, progress: null, count: 1 });
  assert.equal(r.nope, undefined);
});
