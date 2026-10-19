const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
// videoSections imports wanGraph (which imports nothing), so `require` here loads it from source too.
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Math, require: (p) => load(p.replace(/^\.\//, '')) });
  return exports;
}
const { defaultVideoSettings } = load('wanGraph');
const s = load('videoSections');

const base = () => ({ ...defaultVideoSettings(), startImage: '' });
/** A server that has every default file. */
function fullServer(v) {
  const f = v.models[v.mode];
  return {
    models: ['x'], diffusionModels: [f.high, f.low], textEncoders: [v.textEncoder], vaes: [v.vae],
    loras: [v.fastLoras[v.mode].high, v.fastLoras[v.mode].low], upscaleModels: [v.upscale.model],
  };
}

test('sections run top to bottom, mode first and upscale last', () => {
  assert.deepEqual([...s.VIDEO_SECTIONS], ['mode', 'prompt', 'models', 'loras', 'size', 'speed', 'upscale']);
});

test('missing files are split by the section that picks them, and say nothing while the lists are empty', () => {
  const v = { ...base(), upscale: { ...base().upscale, on: true, method: 'model' } };
  const empty = { models: [], diffusionModels: [], textEncoders: [], vaes: [], loras: [], upscaleModels: [] };
  assert.deepEqual([...s.missingVideoFiles(v, empty)], []);

  const none = { models: ['x'], diffusionModels: [], textEncoders: [], vaes: [], loras: [], upscaleModels: [] };
  const by = s.missingVideoFilesBySection(v, none);
  const f = v.models[v.mode];
  assert.deepEqual([...by.models], [f.high, f.low, v.textEncoder, v.vae]);
  assert.deepEqual([...by.speed], v.fast ? [v.fastLoras[v.mode].high, v.fastLoras[v.mode].low] : []);
  assert.deepEqual([...by.upscale], [v.upscale.model]);
  assert.deepEqual([...s.missingVideoFiles(v, none)], [...by.models, ...by.speed, ...by.upscale]);

  assert.deepEqual([...s.missingVideoFiles(v, fullServer(v))], []);
  // Fast off needs no speed LoRAs; a plain resize needs no upscale model.
  const plain = { ...v, fast: false, upscale: { ...v.upscale, method: 'resize' } };
  const by2 = s.missingVideoFilesBySection(plain, none);
  assert.deepEqual([...by2.speed], []);
  assert.deepEqual([...by2.upscale], []);
});

test('summaries say what the next run uses, and warn about what stops it', () => {
  const v = { ...base(), positive: '', mode: 'i2v', fast: true };
  const st = s.videoSectionStatus(v, fullServer(v));
  assert.equal(st.prompt.tone, 'warn');
  assert.equal(st.prompt.note, 'Write a prompt first.');
  assert.equal(st.mode.tone, 'warn');
  assert.equal(st.mode.summary, 'Image → Video · no start image');
  assert.equal(st.speed.summary, 'Fast · 4 steps · CFG 1');
  assert.equal(st.speed.badge, 'fast');
  assert.equal(st.upscale.summary, 'Off');
  assert.equal(st.loras.summary, 'None');

  const w = {
    ...base(), positive: 'a fox runs\nthrough snow', startImage: 'clip/fox.png [input]', mode: 'i2v', fast: false,
    steps: 20, cfg: 3.5, sampler: 'euler', width: 832, height: 480, length: 81, fps: 16,
    loras: [{ id: '1', name: 'loras/wan/motion_high.safetensors', strength: 1, on: true, expert: 'high' }, { id: '2', name: 'off.safetensors', strength: 1, on: false, expert: 'both' }],
    upscale: { ...base().upscale, on: true, method: 'resize', scale: 2, resizeMethod: 'lanczos' },
  };
  const st2 = s.videoSectionStatus(w, fullServer(w));
  assert.equal(st2.mode.summary, 'Image → Video · fox.png');
  assert.equal(st2.mode.tone, undefined);
  assert.equal(st2.prompt.summary, 'a fox runs');
  assert.equal(st2.loras.summary, 'motion_high');
  assert.equal(st2.loras.badge, '1');
  assert.equal(st2.size.summary, '832 × 480 · 81 frames · 5.1 s');
  assert.equal(st2.speed.summary, '20 steps · CFG 3.5 · euler');
  assert.equal(st2.speed.badge, undefined);
  assert.equal(st2.upscale.summary, '1664 × 960 · lanczos resize');
  assert.equal(st2.upscale.badge, '2×');
});

test('a section with a missing file warns with the file names', () => {
  const v = { ...base(), positive: 'x' };
  const server = { ...fullServer(v), vaes: [] };
  const st = s.videoSectionStatus(v, server);
  assert.equal(st.models.tone, 'warn');
  assert.equal(st.models.note, `Not on the server: ${s.fileLabel(v.vae)}`);
  assert.equal(st.speed.tone, v.fast ? 'accent' : undefined);
});

test('labels drop folders, extensions and the [input] tag', () => {
  assert.equal(s.fileLabel('wan/wan2.2_t2v_high.safetensors'), 'wan2.2_t2v_high');
  assert.equal(s.fileLabel('model.gguf'), 'model');
  assert.equal(s.fileLabel('sub/pic.png [input]'), 'pic.png');
  assert.equal(s.videoSeconds({ length: 81, fps: 16 }), '5.1');
});
