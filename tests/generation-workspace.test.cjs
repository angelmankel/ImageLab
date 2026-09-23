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
const { createPass, pipelinePasses, withPipeline, appendPasses, prepareSeeds } = load('pipeline');
const { applyPromptPreset } = load('promptPresets');
const { jobActivity } = load('jobActivity');
const base = { passes: [], sampler: 'euler', scheduler: 'normal', steps: 20, cfg: 7, seed: 42, randomizeSeed: false, width: 512, height: 512, upscaleModel: '4x-AnimeSharp.pth' };
function graphFor(passes, extra = {}) {
  const graph = {};
  const result = appendPasses(graph, { ...base, passes, ...extra }, ['8', 0], ['3', 0], ['4', 0], ['4', 2], 512, 512);
  return { graph, result };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('steps execute in order, including refinement at unchanged size', () => {
  const passes = [createPass(base, 'resize', 'r'), createPass(base, 'sample', 's'), createPass(base, 'remove-bg', 'b')];
  const { graph, result } = graphFor(passes);
  assert.equal(graph.pass0.class_type, 'ImageScaleBy');
  assert.deepEqual(plain(graph.pass1encode.inputs.pixels), ['pass0', 0]);
  assert.equal(graph.pass1sample.class_type, 'KSampler');
  assert.equal(graph.pass1sample.inputs.seed, 42);
  assert.deepEqual(plain(graph.pass2.inputs.image), ['pass1decode', 0]);
  assert.deepEqual(plain(result.image), ['pass2', 0]);
});

test('duplicate finishing steps get separate nodes and disabled passes are bypassed', () => {
  const p = createPass(base, 'upscale', 'a');
  const { graph } = graphFor([p, { ...p, id: 'b', on: false }, { ...p, id: 'c' }]);
  assert.ok(!graph.pass1model);
  assert.deepEqual(plain(graph.pass2up.inputs.image), ['pass0size', 0]);
  assert.equal(graph.pass2size.inputs.width, 2048);
});

test('legacy finishing settings survive until edited without duplicating steps', () => {
  const old = { ...base, upscaleEnabled: true, resizeEnabled: true, resizeScale: 0.5, resizeMode: 'factor', resizeMethod: 'lanczos', removeBg: true };
  const passes = pipelinePasses(old);
  assert.deepEqual(plain(passes.map(p => p.kind)), ['upscale', 'resize', 'remove-bg']);
  assert.equal(pipelinePasses({ ...old, ...withPipeline(passes) }).length, 3);
  const { graph } = graphFor([], old);
  assert.deepEqual(plain(graph.pass1.inputs.image), ['pass0size', 0]);
});

test('new seed affects every sampling pass but preserves auto preferences', () => {
  const workflow = { ...base, passes: [createPass(base, 'sample', 's')] };
  assert.equal(prepareSeeds(workflow, false).seed, 42);
  const changed = prepareSeeds(workflow, true, () => 0.5);
  assert.notEqual(changed.seed, 42);
  assert.notEqual(changed.passes[0].seed, 42);
  assert.equal(changed.randomizeSeed, false);
  assert.equal(changed.passes[0].randomizeSeed, false);
  assert.equal(prepareSeeds(workflow, true, () => 42 / 0xFFFFFFFF).seed, 43);
});

test('single negative preset replacement keeps positives; full presets preserve weights and toggles', () => {
  let n = 0;
  const id = () => String(++n);
  const current = [{ id: 'p', kind: 'positive', text: 'keep me' }, { id: 'n', kind: 'negative', text: 'old' }];
  const snippet = { id: 'saved', kind: 'negative', text: 'new', tag: '', weight: 0.8 };
  const replaced = applyPromptPreset(current, snippet, 'replace', id);
  assert.equal(replaced[0], current[0]);
  assert.equal(replaced[1].text, 'new');
  assert.equal(applyPromptPreset(current, snippet, 'insert', id).length, 3);
  const full = { ...snippet, layers: [{ kind: 'positive', text: 'off', on: false, weight: 1.2, tag: '' }] };
  const restored = applyPromptPreset(current, full, 'replace', id);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].on, false);
  assert.equal(restored[0].weight, 1.2);
});

test('progress is numeric only during sampling and clears on terminal jobs', () => {
  const running = { status: 'running', progress: { value: 6, max: 20 } };
  assert.equal(jobActivity([running], false, true).percent, 30);
  assert.equal(jobActivity([{ status: 'running' }], false, true).percent, null);
  assert.equal(jobActivity([{ status: 'error', progress: running.progress }], false, true).active, false);
  assert.equal(jobActivity([], false, true).label, 'Ready');
  assert.equal(jobActivity([], false, false).label, 'Offline');
  assert.equal(jobActivity([{ status: 'queued' }], false, true).queued, 1);
});
