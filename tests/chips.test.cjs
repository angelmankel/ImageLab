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
  vm.runInNewContext(code, { exports, Math, Number, String });
  return exports;
}
const c = load('chips');
const ids = (l) => Array.from(l, x => x.id);

test('filterChips matches every word against label and keywords', () => {
  const chips = [
    { id: 'steps', label: 'Steps', keywords: ['sampling', 'quality'] },
    { id: 'cfg', label: 'CFG', keywords: ['guidance'] },
    { id: 'size', label: 'Size', keywords: ['width', 'height', 'aspect'] },
  ];
  assert.deepEqual(ids(c.filterChips(chips, '')), ['steps', 'cfg', 'size']);
  assert.deepEqual(ids(c.filterChips(chips, 'guid')), ['cfg']);
  assert.deepEqual(ids(c.filterChips(chips, 'WIDTH')), ['size']);
  assert.deepEqual(ids(c.filterChips(chips, 'size aspect')), ['size']);
  assert.deepEqual(ids(c.filterChips(chips, 'size steps')), []);
});

test('aspect names and number formatting', () => {
  assert.equal(c.aspectLabel(1024, 1024), '1:1');
  assert.equal(c.aspectLabel(1344, 768), '16:9');
  assert.equal(c.aspectLabel(768, 1344), '9:16');
  assert.equal(c.aspectLabel(1216, 832), '3:2');
  assert.equal(c.aspectLabel(1000, 300), '10:3');
  assert.equal(c.fmtNum(7), '7');
  assert.equal(c.fmtNum(7.5), '7.5');
  assert.equal(c.fmtNum(0.30000000000000004), '0.3');
  assert.equal(c.fmtSize(1024, 768), '1024×768');
  assert.equal(c.shortModel('sub/dir/ponyDiffusionV6XL.safetensors'), 'ponyDiffusionV6XL');
  assert.equal(c.shortModel(undefined), 'none');
  assert.equal(c.shortModel('a-very-long-checkpoint-name-indeed.safetensors', 10), 'a-very-lo…');
});

const defaults = { width: 1024, height: 1024, batch: 1, steps: 12, cfg: 8.6, sampler: 'euler_ancestral', scheduler: 'normal', clipSkip: -2, denoise: 1, vae: '' };
const base = {
  checkpoints: [{ name: 'pony.safetensors' }], vae: '', loras: [], embeddings: [],
  width: 1024, height: 1024, batch: 1, steps: 12, cfg: 8.6, sampler: 'euler_ancestral', scheduler: 'normal', clipSkip: -2, denoise: 1,
  inputImage: null, inputDenoise: 0.75, loopback: { enabled: false, iterations: 2 }, passCount: 0,
};

test('a fresh workflow reads as defaults', () => {
  const v = c.imageChipValues(base, defaults);
  assert.equal(v.size.value, '1024×1024 · 1:1');
  assert.equal(v.size.changed, false);
  assert.equal(v.steps.value, '12');
  assert.equal(v.steps.changed, false);
  assert.equal(v.cfg.value, '8.6');
  assert.equal(v.sampling.value, 'euler_ancestral · normal');
  assert.equal(v.sampling.changed, false);
  assert.equal(v.clipSkip.value, '-2');
  assert.equal(v.loras.value, 'none');
  assert.equal(v.input.value, 'none');
  assert.equal(v.loopback.value, 'off');
  assert.equal(v.passes.value, 'none');
  assert.equal(v.vae.value, 'built-in');
  assert.equal(v.checkpoint.value, 'pony');
  assert.equal(v.quality.value, 'n/a');
});

test('changed values fill the chip', () => {
  const v = c.imageChipValues({
    ...base, steps: 30, cfg: 7, width: 1344, height: 768, batch: 4, loras: [{ on: true }, { on: false }],
    inputImage: { width: 640, height: 480 }, inputDenoise: 0.6, loopback: { enabled: true, iterations: 3 }, passCount: 2, clipSkip: -1, vae: 'x.safetensors',
  }, defaults, { on: 3, total: 5 });
  assert.deepEqual({ ...v.steps }, { value: '30', changed: true });
  assert.deepEqual({ ...v.cfg }, { value: '7', changed: true });
  assert.deepEqual({ ...v.size }, { value: '1344×768 · 16:9', changed: true });
  assert.deepEqual({ ...v.batch }, { value: '×4', changed: true });
  assert.deepEqual({ ...v.loras }, { value: '1', changed: true });
  assert.deepEqual({ ...v.input }, { value: '640×480 · img2img', changed: true });
  assert.deepEqual({ ...v.strength }, { value: '0.6', changed: true });
  assert.deepEqual({ ...v.loopback }, { value: '×3', changed: true });
  assert.deepEqual({ ...v.passes }, { value: '2', changed: true });
  assert.deepEqual({ ...v.clipSkip }, { value: 'off', changed: true });
  assert.deepEqual({ ...v.vae }, { value: 'x', changed: true });
  assert.deepEqual({ ...v.quality }, { value: '3/5', changed: true });
});

test('formatParamValue reads widgets the way a chip does', () => {
  assert.equal(c.formatParamValue({ type: 'INT' }, 30), '30');
  assert.equal(c.formatParamValue({ type: 'FLOAT' }, 7.5), '7.5');
  assert.equal(c.formatParamValue({ type: 'INT', seedLike: true }, 123456789012345), '123456789012345');
  assert.equal(c.formatParamValue({ type: 'BOOLEAN' }, true), 'on');
  assert.equal(c.formatParamValue({ type: 'BOOLEAN' }, false), 'off');
  assert.equal(c.formatParamValue({ type: 'COMBO' }, 'models/sub/ponyDiffusionV6XL.safetensors'), 'ponyDiffusionV6XL');
  assert.equal(c.formatParamValue({ type: 'STRING' }, 'a very long prompt that goes on and on and on'), 'a very long prompt that…');
  assert.equal(c.formatParamValue({ type: 'STRING' }, ''), '—');
  assert.equal(c.formatParamValue({ type: 'STRING' }, null), '—');
});
