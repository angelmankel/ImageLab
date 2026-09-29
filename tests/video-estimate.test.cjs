const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const { estimateRun, sampleUnits, outUnits, formatDuration } = load('videoEstimate');

const shape = (o = {}) => ({ width: 832, height: 480, frames: 33, steps: 4, cfg: 1, outWidth: 832, outHeight: 480, upscaleModel: null, modelsKey: 'A', ...o });
const run = (s, ms, extra = {}) => ({
  at: 0, sampleUnits: sampleUnits(s), samplingMs: ms.sampling, outUnits: outUnits(s), finishMs: ms.finish ?? 0,
  upscaleModel: s.upscaleModel, upscaleMs: ms.upscale ?? 0, loadMs: ms.load ?? 0, modelsKey: s.modelsKey, ...extra,
});

test('nothing learned yet: no estimate', () => {
  assert.equal(estimateRun([], shape(), null), null);
});

test('sampling scales with frames, steps and CFG; load only when the models change', () => {
  const runs = [run(shape(), { sampling: 10000, finish: 2000, load: 6000 })];
  const same = estimateRun(runs, shape(), 'A');
  assert.equal(Math.round(same.ms), 12000);
  // Twice the frames, 5x the steps, CFG on: 20x the sampling, 2x the finish.
  const big = estimateRun(runs, shape({ frames: 66, steps: 20, cfg: 3.5 }), 'A');
  assert.equal(Math.round(big.parts.sampling), 200000);
  assert.equal(Math.round(big.parts.finish), 4000);
  // Other models: add the learned load.
  assert.equal(Math.round(estimateRun(runs, shape({ modelsKey: 'B' }), 'A').parts.load), 6000);
});

test('upscale time is learned per model; an unknown one is left out and flagged', () => {
  const up = shape({ outWidth: 1664, outHeight: 960, upscaleModel: 'span' });
  const runs = [run(shape(), { sampling: 10000, finish: 2000 }), run(up, { sampling: 10000, finish: 8000, upscale: 4000 })];
  const e = estimateRun(runs, up, 'A');
  assert.equal(Math.round(e.parts.upscale), 4000);
  assert.equal(e.partial, false);
  const other = estimateRun(runs, { ...up, upscaleModel: 'ultra' }, 'A');
  assert.equal(other.parts.upscale, 0);
  assert.equal(other.partial, true);
  assert.equal(formatDuration(18400), '18 s');
  assert.equal(formatDuration(125000), '2 min 5 s');
});

test('a cold run (new models) does not set the rates once warm runs exist; its extra is the load cost', () => {
  const s = shape();
  const runs = [
    run(s, { sampling: 16000, finish: 30000 }, { modelsKey: 'A' }),   // cold: first run on these models
    run(s, { sampling: 12000, finish: 17000 }, { modelsKey: 'A' }),   // warm
  ];
  const warm = estimateRun(runs, s, 'A');
  assert.equal(Math.round(warm.ms), 29000);
  assert.equal(warm.parts.load, 0);
  // Switching models: the cold run's extra (46 s - 29 s) is added.
  const switched = estimateRun(runs, { ...s, modelsKey: 'B' }, 'A');
  assert.equal(Math.round(switched.parts.load), 17000);
  // Only a cold run so far: use it.
  assert.equal(Math.round(estimateRun(runs.slice(0, 1), s, 'A').ms), 46000);
});
