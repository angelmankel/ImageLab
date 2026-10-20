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
  vm.runInNewContext(code, { exports, Math, Number, String, Set, require: (p) => load(p.replace(/^\.\//, '')) });
  return exports;
}
const { defaultVideoSettings } = load('wanGraph');
const c = load('videoChips');
const ids = (l) => Array.from(l);

const base = () => ({ ...defaultVideoSettings(), startImage: '' });

test('fresh Wan settings read as defaults', () => {
  const v = c.videoChipValues(base());
  assert.equal(v.engine.value, 'Wan 2.2'); assert.equal(v.engine.changed, false);
  assert.equal(v.task.value, 'Text → Video');
  assert.equal(v.size.value, '832×480 · 16:9'); assert.equal(v.size.changed, false);
  assert.equal(v.length.value, '81 f · 5.1 s');
  assert.equal(v.fast.value, 'on · 4 steps'); assert.equal(v.fast.changed, false);
  assert.equal(v.steps.value, '4'); assert.equal(v.cfg.value, '1'); assert.equal(v.switch.value, 'at 2');
  assert.equal(v.sampler.value, 'euler · simple');
  assert.equal(v.upscale.value, 'off'); assert.equal(v.file.value, 'MP4 H.264'); assert.equal(v.file.changed, false);
  assert.equal(v.nag.value, 'off'); assert.equal(v.loras.value, 'none');
  assert.equal(v.models.warn, undefined);
});

test('changes fill the chips and a missing file warns', () => {
  const s = base();
  s.fast = false; s.steps = 30; s.cfg = 5; s.cfgLow = 3; s.width = 1280; s.height = 720; s.upscale = { ...s.upscale, on: true };
  s.encode = { container: 'webm', codec: 'av1', crf: 30 }; s.guidance = { ...s.guidance, nag: { ...s.guidance.nag, on: true } };
  const server = { models: ['x'], diffusionModels: [s.models.t2v.high], textEncoders: [s.textEncoder], vaes: [s.vae], loras: [], upscaleModels: [] };
  const v = c.videoChipValues(s, server);
  assert.deepEqual({ ...v.steps }, { value: '30', changed: true });
  assert.equal(v.cfg.value, '5 / 3'); assert.equal(v.cfg.changed, true);
  assert.equal(v.size.value, '1280×720 · 16:9'); assert.equal(v.size.changed, true);
  assert.equal(v.fast.value, 'off'); assert.equal(v.fast.changed, true);
  assert.equal(v.upscale.value, '2× → 2560×1440'); assert.equal(v.upscale.changed, true);
  assert.ok(v.upscale.warn.includes('2xNomosUni'));
  assert.equal(v.file.value, 'WEBM AV1 · CRF 30');
  assert.equal(v.nag.value, '11');
  assert.ok(v.models.warn.includes('low_noise'));
});

test('the visible chips follow the engine and the task', () => {
  const wan = ids(c.visibleVideoChips(base()));
  assert.ok(wan.includes('fast') && wan.includes('switch') && wan.includes('fps') && wan.includes('nag'));
  assert.ok(!wan.includes('start') && !wan.includes('turbo') && !wan.includes('audio'));
  const i2v = ids(c.visibleVideoChips({ ...base(), mode: 'i2v' }));
  assert.ok(i2v.includes('start') && i2v.includes('end') && i2v.includes('colorMatch'));
  const h3 = ids(c.visibleVideoChips({ ...base(), engine: 'h3', h3: { ...base().h3, mode: 'ref' } }));
  assert.ok(h3.includes('turbo') && h3.includes('audio') && h3.includes('refs') && h3.includes('refSize') && h3.includes('lowVramAttention'));
  assert.ok(!h3.includes('switch') && !h3.includes('fps') && !h3.includes('nag'));
});

test('H3 readings', () => {
  const s = base(); s.engine = 'h3'; s.h3 = { ...s.h3, mode: 'i2v', turbo: { ...s.h3.turbo, on: true } }; s.startImage = 'imagelab/frame.png';
  const v = c.videoChipValues(s);
  assert.equal(v.engine.value, 'MiniMax H3'); assert.equal(v.task.value, 'First frame');
  assert.equal(v.start.value, 'frame.png'); assert.equal(v.start.changed, true);
  assert.equal(v.turbo.value, 'on · 8 steps'); assert.equal(v.steps.value, '8');
  assert.equal(v.length.value, '124 f · 5.2 s'); assert.equal(v.audio.value, 'on');
  assert.equal(v.shift.value, '12 · audio 3');
});
