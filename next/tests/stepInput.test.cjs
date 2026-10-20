// The step-to-step input rule (stepInputLogic.ts): Off · Auto · Pick, by the step that made each result.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const H = load('src/screens/image/historyLogic.ts');
const S = load('src/app/stepsLogic.ts');
const L = load('src/screens/image/stepInputLogic.ts', { './historyLogic': H, '~/app/stepsLogic': S });

const img = (k, t) => ({ key: k, url: `u/${k}`, kind: 'image', filename: `${k}.png`, createdAt: t });
const vid = (k, t) => ({ key: k, url: `u/${k}`, kind: 'video', filename: `${k}.mp4`, createdAt: t });

const s1 = { id: 's1', kind: 'image', name: 'Image', edited: false, chained: false };
const s2 = { id: 's2', kind: 'video', name: 'Video', edited: false, chained: true };
const s3 = { id: 's3', kind: 'workflow', name: 'Flow', edited: false, chained: true };
const steps = [s1, s2, s3];
// a, b by step 1 (b untagged, made before tagging); c by step 3's run; v1 a clip by step 2; w1 a run by step 3.
const tags = { a: 's1', c: 's3', v1: 's2', w1: 's3' };
const results = L.mergeResults([img('a', 5), img('b', 2), img('c', 7)], [vid('v1', 6)], [img('w1', 4)]);

test('mergeResults: one list, newest first, each with its source', () => {
  assert.deepEqual(results.map((r) => r.key), ['c', 'v1', 'a', 'w1', 'b']);
  assert.equal(results.find((r) => r.key === 'v1').source, 'video');
  assert.equal(results.find((r) => r.key === 'w1').source, 'workflow');
  assert.equal(results.find((r) => r.key === 'a').name, 'a.png');
});

test('a step\'s own results: tagged to it, or untagged of its kind; newest first', () => {
  assert.deepEqual(L.resultsOfStep(s1, steps, tags, results).map((r) => r.key), ['a', 'b']);
  assert.deepEqual(L.resultsOfStep(s2, steps, tags, results).map((r) => r.key), ['v1']);
  assert.deepEqual(L.resultsOfStep(s3, steps, tags, results).map((r) => r.key), ['c', 'w1']);
  assert.deepEqual(L.newestResultOf(s1, steps, tags, results), { url: 'u/a', name: 'a.png' });
  assert.equal(L.newestResultOf(null, steps, tags, results), null);
  // An Upscale step (no runner yet) passes its explicit input through.
  const up = { id: 'up', kind: 'upscale', name: 'Up', edited: false, chained: true, input: { url: 'u/x', name: 'x.png' } };
  assert.deepEqual(L.newestResultOf(up, [s1, up], tags, results), { url: 'u/x', name: 'x.png' });
});

test('Auto: the newest result made BY the previous step, not the newest of its kind', () => {
  // c (newest image) was made by step 3; step 2 chains to step 1, whose newest is a.
  const r = L.resolveStepInput(s2, steps, tags, results);
  assert.equal(r.kind, 'chained');
  assert.equal(r.mode, 'auto');
  assert.deepEqual(r.src, { url: 'u/a', name: 'a.png' });
  assert.equal(r.from.id, 's1');
  assert.equal(r.pickLost, false);
  // Step 3 chains to the video step's clip.
  assert.deepEqual(L.resolveStepInput(s3, steps, tags, results).src, { url: 'u/v1', name: 'v1.mp4' });
});

test('Pick: the chosen result while it exists; gone → Auto, flagged', () => {
  const picked = S.withChainMode(s2, 'pick', { key: 'b', url: 'u/b', name: 'b.png' });
  const r = L.resolveStepInput(picked, [s1, picked, s3], tags, results);
  assert.deepEqual(r, { kind: 'chained', mode: 'pick', src: { url: 'u/b', name: 'b.png' }, from: s1, pickLost: false });
  const deleted = results.filter((x) => x.key !== 'b');
  const f = L.resolveStepInput(picked, [s1, picked, s3], tags, deleted);
  assert.deepEqual(f, { kind: 'chained', mode: 'pick', src: { url: 'u/a', name: 'a.png' }, from: s1, pickLost: true });
  // Pick mode with nothing chosen yet behaves as Auto, not flagged.
  const bare = S.withChainMode(s2, 'pick');
  assert.deepEqual(L.resolveStepInput(bare, [s1, bare, s3], tags, results), { kind: 'chained', mode: 'pick', src: { url: 'u/a', name: 'a.png' }, from: s1, pickLost: false });
});

test('waiting, Off, explicit input, step 1', () => {
  const w = L.resolveStepInput(s2, steps, tags, []);
  assert.deepEqual(w, { kind: 'waiting', mode: 'auto', from: s1, pickLost: false });
  const off = S.withChainMode(s2, 'off');
  assert.deepEqual(L.resolveStepInput(off, [s1, off, s3], tags, results), { kind: 'none', mode: 'off' });
  const mine = { ...s2, chained: false, input: { url: 'data:x', name: 'mine.png' } };
  assert.deepEqual(L.resolveStepInput(mine, [s1, mine, s3], tags, results), { kind: 'explicit', mode: 'off', src: { url: 'data:x', name: 'mine.png' } });
  // An explicit input wins over a stale chained flag (what the store writes).
  const stale = { ...s2, chained: true, input: { url: 'data:x', name: 'mine.png' } };
  assert.equal(L.resolveStepInput(stale, [s1, stale, s3], tags, results).kind, 'explicit');
  assert.deepEqual(L.resolveStepInput(s1, steps, tags, results), { kind: 'none', mode: 'off' });
});

test('chainCandidate: what the previous step offers, whatever the mode is on', () => {
  const off = S.withChainMode(s2, 'off');
  assert.deepEqual(L.chainCandidate(off, [s1, off, s3], tags, results).src, { url: 'u/a', name: 'a.png' });
  assert.deepEqual(L.chainCandidate(s1, steps, tags, results), { from: null, src: null, pickLost: false });
  assert.deepEqual(L.toChainPick(results[0]), { key: 'c', url: 'u/c', name: 'c.png' });
});
