const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
// loopback.ts imports only types; pipeline.ts likewise — both load from source.
const L = load('src/screens/image/settings/loopback.ts');
const P = load('../src/lib/pipeline.ts');

const base = { enabled: true, iterations: 4, upscale: 1.5, denoise: 0.5, steps: 10, cfg: 7, autoDenoise: false, denoiseStart: 0.6, denoiseEnd: 0.3 };

test('clamps: rounds 1–10 whole, grow on 0.05, cfg on 0.5, nothing NaN', () => {
  assert.equal(L.clampRounds(0), 1);
  assert.equal(L.clampRounds(4.7), 4);
  assert.equal(L.clampRounds(99), 10);
  assert.equal(L.clampRounds(NaN), 1);
  assert.equal(L.clampTo(1.26, L.GROW_MIN, L.GROW_MAX, L.GROW_STEP), 1.25);
  assert.equal(L.clampTo(2.5, L.GROW_MIN, L.GROW_MAX, L.GROW_STEP), 2);
  assert.equal(L.clampTo(7.3, L.CFG_MIN, L.CFG_MAX, L.CFG_STEP), 7.5);
  assert.equal(L.clampTo(0.1 + 0.2, L.DENOISE_MIN, L.DENOISE_MAX, L.DENOISE_STEP), 0.3); // no float tails
  assert.equal(L.clampTo(NaN, 1, 60, 1), 1);
});

test('patches keep every other field (ramps, frame) so the classic UI still works', () => {
  const frame = { enabled: true, start: { x: 0.5, y: 0.5, w: 1, h: 1 }, end: { x: 0.4, y: 0.4, w: 0.5, h: 0.5 } };
  const lb = { ...base, ramps: { steps: { start: 20, end: 10 } }, frame };
  const out = L.setRounds(L.setGrow(L.setDenoise(lb, 0.4), 1.25), 3);
  assert.deepEqual(out.ramps, { steps: { start: 20, end: 10 } });
  assert.strictEqual(out.frame, frame);
  assert.equal(out.iterations, 3);
  assert.equal(out.upscale, 1.25);
  assert.equal(out.denoise, 0.4);
  assert.equal(out.enabled, true);
  assert.equal(lb.iterations, 4); // never mutated
});

test('denoise: "same every round" flips autoDenoise and keeps the saved ends', () => {
  const ranged = L.setSameEveryRound(base, false);
  assert.equal(ranged.autoDenoise, true);
  assert.deepEqual(L.denoiseRange(ranged), { start: 0.6, end: 0.3 });
  const same = L.setSameEveryRound(ranged, true);
  assert.equal(same.autoDenoise, false);
  assert.equal(same.denoiseStart, 0.6); // the ends stay for next time
  assert.equal(same.denoise, 0.5);
  // defaults when a saved workflow has none
  assert.deepEqual(L.denoiseRange({ ...base, denoiseStart: undefined, denoiseEnd: undefined }), { start: 0.6, end: 0.3 });
  const set = L.setDenoiseRange(base, { start: 0.72, end: 0.33 });
  assert.deepEqual([set.autoDenoise, set.denoiseStart, set.denoiseEnd], [true, 0.7, 0.35]);
});

test('a range can rise or fall: the handles hold [low, high], the direction is separate', () => {
  assert.deepEqual(L.handlesOf({ start: 0.6, end: 0.3 }), [0.3, 0.6]);
  assert.equal(L.isFalling({ start: 0.6, end: 0.3 }), true);
  assert.equal(L.isFalling({ start: 0.3, end: 0.6 }), false);
  assert.deepEqual(L.rampFromHandles(0.3, 0.6, true), { start: 0.6, end: 0.3 });
  assert.deepEqual(L.rampFromHandles(0.6, 0.3, false), { start: 0.3, end: 0.6 });
  // what the pipeline runs with it: even steps from first to last, either direction
  assert.deepEqual(P.loopbackDenoises({ ...base, autoDenoise: true, iterations: 4 }), [0.6, 0.5, 0.4, 0.3]);
  assert.deepEqual(P.loopbackDenoises({ ...base, autoDenoise: true, denoiseStart: 0.3, denoiseEnd: 0.6, iterations: 3 }), [0.3, 0.45, 0.6]);
  assert.deepEqual(P.loopbackDenoises(base), [0.5, 0.5, 0.5, 0.5]);
});

test('ramps: set one, keep the others, clear the last one drops the key', () => {
  const a = L.setRamp(base, 'steps', { start: 20, end: 10 });
  const b = L.setRamp(a, 'cfg', { start: 7, end: 5 });
  assert.deepEqual(b.ramps, { steps: { start: 20, end: 10 }, cfg: { start: 7, end: 5 } });
  const c = L.setRamp(b, 'steps', undefined);
  assert.deepEqual(c.ramps, { cfg: { start: 7, end: 5 } });
  const d = L.setRamp(c, 'cfg', undefined);
  assert.equal('ramps' in d, false);
  // the pipeline reads them per round
  const rounds = P.loopbackRounds({ ...b, iterations: 3 });
  assert.deepEqual(rounds.map((r) => r.steps), [20, 15, 10]);
  assert.deepEqual(rounds.map((r) => r.cfg), [7, 6, 5]);
  assert.deepEqual(rounds.map((r) => r.upscale), [1.5, 1.5, 1.5]);
});

test('a ramp switched on starts at the fixed value', () => {
  assert.deepEqual(L.defaultRamp(base, 'upscale'), { start: 1.5, end: 1.75 });
  assert.deepEqual(L.defaultRamp({ ...base, upscale: 2 }, 'upscale'), { start: 2, end: 2 });
  assert.deepEqual(L.defaultRamp(base, 'steps'), { start: 10, end: 5 });
  assert.deepEqual(L.defaultRamp(base, 'cfg'), { start: 7, end: 5 });
  assert.deepEqual(L.defaultRamp(base, 'noise'), { start: 0.2, end: 0 });
  assert.deepEqual(L.defaultRamp({ ...base, noise: 0.4 }, 'noise'), { start: 0.4, end: 0 });
});

test('the frame path is only switched, never redrawn', () => {
  assert.strictEqual(L.setFrameEnabled(base, true), base); // nothing saved → nothing to switch on
  const frame = { enabled: true, start: { x: 0.5, y: 0.5 }, end: { x: 0.5, y: 0.5, zoom: 2 } };
  const off = L.setFrameEnabled({ ...base, frame }, false);
  assert.deepEqual(off.frame, { ...frame, enabled: false });
  assert.deepEqual(off.frame.end, frame.end);
});

test('the summary explains the "5 loops" at a glance', () => {
  assert.equal(L.loopbackSummary({ ...base, iterations: 5 }), '×5 · grow 1.5 · denoise 0.5');
  assert.equal(L.loopbackSummary({ ...base, autoDenoise: true }), '×4 · grow 1.5 · denoise 0.6→0.3');
  assert.equal(L.loopbackSummary({ ...base, upscale: 1.25, autoDenoise: true, denoiseStart: 0.3, denoiseEnd: 0.6 }), '×4 · grow 1.25 · denoise 0.3→0.6');
  assert.equal(
    L.loopbackSummary({ ...base, noise: 0.2, ramps: { upscale: { start: 1.25, end: 1.5 }, steps: { start: 20, end: 10 }, cfg: { start: 7, end: 5.5 } } }),
    '×4 · grow 1.25→1.5 · denoise 0.5 · steps 20→10 · cfg 7→5.5 · noise 0.2',
  );
  assert.equal(L.loopbackSummary({ ...base, iterations: 2, frame: { enabled: true, start: { x: 0.5, y: 0.5 }, end: { x: 0.5, y: 0.5 } } }), '×2 · grow 1.5 · denoise 0.5 · frame');
  assert.equal(L.loopbackSummary({ ...base, iterations: 50 }), '×10 · grow 1.5 · denoise 0.5'); // as the pipeline clamps it
});

test('the size label follows the pipeline: ×1.5 four times from 1024 is 5184, capped at 4096', () => {
  const sizes = P.loopbackSizes(base, 1024, 1024);
  assert.deepEqual(sizes, [[1536, 1536], [2304, 2304], [3456, 3456], [4096, 4096]]);
  assert.equal(L.growLabel(1024, 1024, sizes[sizes.length - 1]), '1024 → 4096 px');
  const two = P.loopbackSizes({ ...base, iterations: 2, upscale: 2 }, 832, 1216);
  assert.equal(L.growLabel(832, 1216, two[two.length - 1]), '1216 → 4096 px');
  const one = P.loopbackSizes({ ...base, iterations: 1, upscale: 1.25 }, 1024, 768);
  assert.equal(L.growLabel(1024, 768, one[one.length - 1]), '1024 → 1280 px');
  assert.equal(L.growLabel(1024, 768, undefined), '1024 → 1024 px');
});

test('labels', () => {
  assert.equal(L.fmtNum(1.25), '1.25');
  assert.equal(L.fmtNum(1.5), '1.5');
  assert.equal(L.fmtNum(0.3), '0.3');
  assert.equal(L.fmtNum(20, 0), '20');
  assert.equal(L.fmtNum(7, 1), '7');
  assert.equal(L.rampLabel({ start: 0.6, end: 0.3 }), '0.6 → 0.3');
  assert.deepEqual([...L.ROUND_CHIPS], [2, 3, 4, 5]);
  assert.deepEqual([...L.GROW_CHIPS], [1, 1.25, 1.5, 2]);
  assert.deepEqual([...L.DENOISE_CHIPS], [0.3, 0.4, 0.5, 0.6]);
});
