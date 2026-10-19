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
  vm.runInNewContext(code, { exports, Math, JSON, require: (p) => load(p.replace(/^\.\//, '')) });
  return exports;
}
const { defaultVideoSettings } = load('wanGraph');
const p = load('videoPresets');
const plain = (v) => JSON.parse(JSON.stringify(v));

test('a preset carries the recipe, never the prompt, the seed or the end frame', () => {
  const s = { ...defaultVideoSettings(), positive: 'a fox', seed: 9, randomizeSeed: false, endImage: 'e.png', cfg: 6, fast: false };
  const body = plain(p.presetBody(s));
  for (const k of p.PRESET_EXCLUDED) assert.equal(k in body, false, k);
  assert.deepEqual([body.cfg, body.fast, body.negative], [6, false, s.negative]);
});

test('applying a preset keeps what it left out and fills what an old preset lacks', () => {
  const recipe = { ...defaultVideoSettings(), cfg: 6, fast: false, shift: 5, guidance: { cfgZeroStar: true, nag: { on: false, scale: 5, alpha: 0.5, tau: 1.5 } } };
  const preset = { id: '1', name: 'Crisp', savedAt: 0, settings: p.presetBody(recipe) };
  const current = { ...defaultVideoSettings(), positive: 'my prompt', seed: 77, randomizeSeed: false, endImage: 'end.png', mode: 'i2v', cfg: 2 };
  const out = plain(p.applyPreset(current, preset));
  assert.deepEqual([out.positive, out.seed, out.randomizeSeed, out.endImage], ['my prompt', 77, false, 'end.png']);
  assert.deepEqual([out.cfg, out.fast, out.shift, out.guidance.cfgZeroStar, out.mode], [6, false, 5, true, 't2v']);
  assert.ok(p.matchesPreset(out, preset));
  assert.ok(!p.matchesPreset(current, preset));
  // A preset saved before a field existed: the field keeps its default, and still matches.
  const old = { settings: { cfg: 6, fast: false } };
  const applied = plain(p.applyPreset(current, old));
  assert.deepEqual(applied.encode, { container: 'mp4', codec: 'h264', crf: null });
  assert.equal(applied.cfg, 6);
  assert.ok(p.matchesPreset(applied, old));
});

test('names stay unique', () => {
  assert.equal(p.uniquePresetName('Crisp', []), 'Crisp');
  assert.equal(p.uniquePresetName('Crisp', ['Crisp']), 'Crisp 2');
  assert.equal(p.uniquePresetName('Crisp', ['Crisp', 'Crisp 2']), 'Crisp 3');
  assert.equal(p.uniquePresetName('  ', []), 'Preset');
});
