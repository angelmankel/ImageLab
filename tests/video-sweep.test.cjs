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
  vm.runInNewContext(code, { exports, Math, require: (p) => load(p.replace(/^\.\//, '')) });
  return exports;
}
const { defaultVideoSettings, buildWanGraph } = load('wanGraph');
const sw = load('videoSweep');
const plain = (v) => JSON.parse(JSON.stringify(v));

test('values are evenly spaced, snapped to the step, without duplicates', () => {
  assert.deepEqual([...sw.sweepValues(2, 5, 4, 0.5)], [2, 3, 4, 5]);
  assert.deepEqual([...sw.sweepValues(1, 10, 4, 1)], [1, 4, 7, 10]);
  assert.deepEqual([...sw.sweepValues(0.6, 1, 3, 0.05)], [0.6, 0.8, 1]);
  assert.deepEqual([...sw.sweepValues(3, 3, 5, 1)], [3]);      // a degenerate range is one run
  assert.deepEqual([...sw.sweepValues(7, 7.2, 3, 0.5)], [7]);  // snapping merges the duplicates
  assert.deepEqual([...sw.sweepValues(5, 1, 3, 1)], [5, 3, 1]); // downwards works too
});

test('a seed sweep counts up from the start; other axes hold the seed and fix what they imply', () => {
  const base = { ...defaultVideoSettings(), positive: 'x', seed: 42, fast: true, steps: 20, switchStep: 10 };
  const seeds = plain(sw.sweepItems(base, 'seed', 100, 0, 3));
  assert.deepEqual(seeds, [{ label: 'seed 100', patch: { seed: 100 } }, { label: 'seed 101', patch: { seed: 101 } }, { label: 'seed 102', patch: { seed: 102 } }]);
  const cfg = plain(sw.sweepItems(base, 'cfg', 2, 5, 2));
  assert.deepEqual(cfg, [{ label: 'CFG 2', patch: { fast: false, cfg: 2 } }, { label: 'CFG 5', patch: { fast: false, cfg: 5 } }]);
  // Applied to the settings, the two graphs differ only in the CFG (the seed is the base's).
  const [a, b] = cfg.map((it) => plain(buildWanGraph({ ...base, ...it.patch })));
  assert.equal(a['11'].inputs.noise_seed, 42);
  assert.deepEqual([a['11'].inputs.cfg, b['11'].inputs.cfg, a['11'].inputs.steps], [2, 5, 20]);
  const stripped = (g) => { const c = plain(g); for (const id of ['11', '12']) delete c[id].inputs.cfg; return c; };
  assert.deepEqual(stripped(a), stripped(b));
  // Steps keep the switch at the same fraction; the lightx2v strength sweep turns Fast on.
  const steps = plain(sw.sweepItems(base, 'steps', 10, 30, 2));
  assert.deepEqual(steps.map((i) => i.patch), [{ fast: false, steps: 10, switchStep: 5 }, { fast: false, steps: 30, switchStep: 15 }]);
  const str = plain(sw.sweepItems({ ...base, fast: false }, 'fastStrength', 0.5, 1, 2));
  assert.deepEqual(str[0].patch, { fast: true, fastRecipe: { steps: 4, switchStep: 2, cfg: 1, strengthHigh: 0.5, strengthLow: 0.5, motionSteps: 0, motionCfg: 3.5 } });
  assert.equal(str[1].label, 'lightx2v strength 1');
  const nag = plain(sw.sweepItems(base, 'nagScale', 2, 8, 2));
  assert.deepEqual(nag[1].patch.guidance.nag, { on: true, scale: 8, alpha: 0.25, tau: 2.5 });
  // No LoRA on: the LoRA axis makes empty patches rather than inventing one.
  assert.deepEqual(plain(sw.sweepItems(base, 'loraStrength', 0.5, 1, 2)).map((i) => i.patch), [{}, {}]);
  const withLora = { ...base, loras: [{ id: 'a', name: 'x.safetensors', strength: 1, on: false, expert: 'both' }, { id: 'b', name: 'y.safetensors', strength: 1, on: true, expert: 'high', strengthLow: 0.3 }] };
  const lo = plain(sw.sweepItems(withLora, 'loraStrength', 0.5, 1, 2));
  assert.deepEqual(lo[0].patch.loras[1], { id: 'b', name: 'y.safetensors', strength: 0.5, on: true, expert: 'high', strengthLow: null });
  assert.deepEqual(lo[0].patch.loras[0], withLora.loras[0]);
  assert.deepEqual([...sw.sweepItems(base, 'nope', 0, 1, 2)], []);
});
