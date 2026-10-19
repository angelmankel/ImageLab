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
const { buildWanGraph, defaultVideoSettings, wanLength, wanSide, isVideoName } = load('wanGraph');
const plain = (v) => JSON.parse(JSON.stringify(v));
const classes = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.class_type]));

test('text to video: two experts hand over at the switch step, saved as MP4', () => {
  const g = plain(buildWanGraph({ ...defaultVideoSettings(), fast: false, positive: 'a fox', seed: 7 }));
  assert.equal(g['1'].inputs.unet_name, 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors');
  assert.equal(g['2'].inputs.unet_name, 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors');
  assert.equal(g['10'].class_type, 'EmptyHunyuanLatentVideo');
  assert.deepEqual([g['10'].inputs.width, g['10'].inputs.height, g['10'].inputs.length], [832, 480, 81]);
  const hi = g['11'].inputs, lo = g['12'].inputs;
  assert.deepEqual([hi.model, hi.add_noise, hi.start_at_step, hi.end_at_step, hi.return_with_leftover_noise, hi.noise_seed], [['1s', 0], 'enable', 0, 10, 'enable', 7]);
  assert.deepEqual([lo.model, lo.add_noise, lo.start_at_step, lo.end_at_step, lo.latent_image], [['2s', 0], 'disable', 10, 10000, ['11', 0]]);
  assert.equal(g['3'].inputs.type, 'wan');
  assert.deepEqual(g['15'].inputs, { video: ['14', 0], filename_prefix: 'video/ImageLab_T2V', format: 'mp4', codec: 'h264' });
  assert.equal(g['9'], undefined);
});

test('image to video: the start image feeds WanImageToVideo, whose outputs drive both samplers', () => {
  const g = plain(buildWanGraph({ ...defaultVideoSettings(), fast: false, mode: 'i2v', positive: 'she smiles' }, 'imagelab/start.png'));
  assert.equal(g['1'].inputs.unet_name, 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors');
  assert.equal(g['9'].inputs.image, 'imagelab/start.png');
  assert.deepEqual(g['10'].inputs.start_image, ['9', 0]);
  for (const id of ['11', '12']) {
    assert.deepEqual([g[id].inputs.positive, g[id].inputs.negative], [['10', 0], ['10', 1]]);
  }
  assert.deepEqual(g['11'].inputs.latent_image, ['10', 2]);
});

test('LoRAs patch the expert they belong to; sizes and lengths snap to what Wan takes', () => {
  const s = { ...defaultVideoSettings(), fast: false, positive: 'x', steps: 8, switchStep: 20, width: 830, length: 80, loras: [
    { id: 'a', name: 'motion_high.safetensors', strength: 1, on: true, expert: 'high' },
    { id: 'b', name: 'motion_low.safetensors', strength: 0.8, on: true, expert: 'low' },
    { id: 'c', name: 'style.safetensors', strength: 1, on: true, expert: 'both' },
    { id: 'd', name: 'off.safetensors', strength: 1, on: false, expert: 'both' },
  ] };
  const g = plain(buildWanGraph(s));
  const c = classes(g);
  assert.deepEqual(Object.keys(c).filter((k) => c[k] === 'LoraLoaderModelOnly').sort(), ['1l0', '1l2', '2l1', '2l2']);
  assert.deepEqual(g['1s'].inputs.model, ['1l2', 0]);
  assert.deepEqual(g['1l2'].inputs.model, ['1l0', 0]);
  assert.equal(g['2l1'].inputs.strength_model, 0.8);
  // Switch step past the step count is clamped; the low expert then runs nothing past the end.
  assert.equal(g['11'].inputs.end_at_step, 8);
  assert.equal(g['10'].inputs.width, 832);
  assert.equal(g['10'].inputs.length, 81);
  assert.equal(wanLength(2), 5); assert.equal(wanLength(50), 49); assert.equal(wanSide(470), 464);
  assert.equal(isVideoName('ImageLab_T2V_00001_.mp4'), true); assert.equal(isVideoName('x.png'), false);
});

test('installed Wan files fill in for missing ones, only when the choice is clear', () => {
  const { pickInstalledWanFiles } = load('wanGraph');
  const s = defaultVideoSettings();
  const server = {
    diffusionModels: ['anima_turboV11.safetensors', 'smoothMixWan2214BI2V_t2vHighV40.safetensors', 'smoothMixWan2214BI2V_t2vLowV40.safetensors', 'flux1-dev.safetensors'],
    textEncoders: ['qwen_3_06b_base.safetensors', 'umt5_xxl_fp8_e4m3fn_scaled.safetensors'],
    vaes: ['qwen_image_vae.safetensors', 'wan_2.1_vae.safetensors'],
  };
  const p = plain(pickInstalledWanFiles({ ...s, textEncoder: 'umt5_xxl_fp16.safetensors', vae: 'gone.safetensors' }, server));
  assert.deepEqual(p.models.t2v, { high: 'smoothMixWan2214BI2V_t2vHighV40.safetensors', low: 'smoothMixWan2214BI2V_t2vLowV40.safetensors' });
  assert.deepEqual(p.models.i2v, plain(s.models.i2v));
  assert.equal(p.textEncoder, 'umt5_xxl_fp8_e4m3fn_scaled.safetensors');
  assert.equal(p.vae, 'wan_2.1_vae.safetensors');
  // I2V: no i2v files installed, nothing changes.
  assert.deepEqual(plain(pickInstalledWanFiles({ ...s, mode: 'i2v', textEncoder: server.textEncoders[1], vae: server.vaes[1] }, server)), {});
  // Two candidates for one slot: leave the choice to the person.
  const two = { ...server, diffusionModels: [...server.diffusionModels, 'wan2.2_t2v_high_noise_14B_fp16.safetensors'] };
  assert.equal(plain(pickInstalledWanFiles(s, two)).models.t2v.high, s.models.t2v.high);
});

test('fast mode: the lightx2v LoRA of the mode first on each expert, 4 steps, switch at 2, CFG 1', () => {
  const s = { ...defaultVideoSettings(), mode: 'i2v', positive: 'x', steps: 30, cfg: 5, switchStep: 15, loras: [
    { id: 'a', name: 'style_high.safetensors', strength: 1, on: true, expert: 'high' },
  ] };
  const g = plain(buildWanGraph(s, 'start.png'));
  assert.equal(g['1f'].inputs.lora_name, 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors');
  assert.equal(g['2f'].inputs.lora_name, 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors');
  assert.deepEqual(g['1l0'].inputs.model, ['1f', 0]);      // the person's LoRA after the speed one
  assert.deepEqual(g['2s'].inputs.model, ['2f', 0]);
  assert.deepEqual([g['11'].inputs.steps, g['11'].inputs.end_at_step, g['11'].inputs.cfg], [4, 2, 1]);
  assert.deepEqual([g['12'].inputs.start_at_step, g['12'].inputs.cfg], [2, 1]);
});

test('upscale: off adds nothing; a model runs then lands on the exact even size; resize alone', () => {
  const base = { ...defaultVideoSettings(), positive: 'x' };
  assert.equal(plain(buildWanGraph(base))['16'], undefined);
  const m = plain(buildWanGraph({ ...base, upscale: { ...base.upscale, on: true, scale: 1.5 } }));
  assert.equal(m['16m'].inputs.model_name, '2xNomosUni_span_multijpg.safetensors');
  assert.deepEqual(m['16x'].inputs.image, ['13', 0]);
  assert.deepEqual([m['16'].inputs.width, m['16'].inputs.height, m['16'].inputs.image], [1248, 720, ['16x', 0]]);
  assert.deepEqual(m['14'].inputs.images, ['16', 0]);
  const r = plain(buildWanGraph({ ...base, width: 830, upscale: { ...base.upscale, on: true, method: 'resize', scale: 2, resizeMethod: 'bicubic' } }));
  assert.equal(r['16m'], undefined);
  assert.deepEqual([r['16'].inputs.upscale_method, r['16'].inputs.width, r['16'].inputs.image], ['bicubic', 1664, ['13', 0]]);
});

test('run shape and timing come from the graph: fast, upscale, parts', () => {
  const { wanRunShape, wanRunTiming } = load('wanGraph');
  const g = plain(buildWanGraph({ ...defaultVideoSettings(), positive: 'x', length: 33, upscale: { ...defaultVideoSettings().upscale, on: true } }));
  const shape = plain(wanRunShape(g));
  assert.deepEqual([shape.width, shape.height, shape.frames, shape.steps, shape.cfg, shape.outWidth, shape.outHeight, shape.upscaleModel],
    [832, 480, 33, 4, 1, 1664, 960, '2xNomosUni_span_multijpg.safetensors']);
  assert.ok(shape.modelsKey.includes('wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors'));
  const t = plain(wanRunTiming(g, { '1': 3000, '3': 2000, '11': 5000, '12': 4000, '13': 1000, '16x': 2500, '16': 300, '14': 100, '15': 1500 }, 1));
  assert.deepEqual([t.samplingMs, t.upscaleMs, t.finishMs, t.loadMs], [9000, 2500, 2900, 5000]);
  assert.equal(t.sampleUnits, 832 * 480 * 33 * 4 / 1e9);
});

test('GGUF models load through UnetLoaderGGUF; a model with the speed LoRA inside gets no second one', () => {
  const { speedLoraBuiltIn } = load('wanGraph');
  const s = defaultVideoSettings();
  s.mode = 'i2v';
  s.models.i2v = { high: 'wan22EnhancedNSFWSVICamera_nsfwFASTMOVEV2Q8H.gguf', low: 'smoothMixWan2214BI2V_i2vV20Low.safetensors' };
  const g = plain(buildWanGraph({ ...s, fast: true, positive: 'x' }, 'a.png'));
  assert.deepEqual(g['1'], { class_type: 'UnetLoaderGGUF', inputs: { unet_name: s.models.i2v.high }, _meta: { title: 'High-noise model' } });
  assert.equal(g['2'].class_type, 'UNETLoader');
  assert.equal(g['1f'], undefined);                       // Lightning is merged into this one
  assert.equal(g['1s'].inputs.model[0], '1');
  assert.equal(g['2f'].inputs.lora_name, s.fastLoras.i2v.low);
  // The user's mark wins over the name.
  const marked = plain(buildWanGraph({ ...s, fast: true, speedInside: { [s.models.i2v.high]: false } }, 'a.png'));
  assert.equal(marked['1f'].inputs.lora_name, s.fastLoras.i2v.high);
  assert.equal(speedLoraBuiltIn('smoothMixWan2214BI2V_t2vHighV40.safetensors'), true);
  assert.equal(speedLoraBuiltIn('smoothMixWan2214BI2V_i2vV20High.safetensors'), false);
  assert.equal(speedLoraBuiltIn('wan22EnhancedNSFWSVICamera_nolightningSVICfQ8H.gguf'), false);
  assert.equal(speedLoraBuiltIn('wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors'), false);
});

// ── The parameters added in October 2026 ─────────────────────────────────────

const { loadVideoSettings, saveVideoInputs, effectiveSampling, outputFrames, wanRunShape, wanRunTiming } = load('wanGraph');

/** The saved `imagelab.video.v1` of a browser from before the new fields existed. */
const OLD_SAVED = {
  mode: 'i2v', positive: 'she waves', negative: 'blurry', startImage: 'clip/a.png [input]',
  models: { t2v: { high: 'smoothMixWan2214BI2V_t2vHighV40.safetensors', low: 'smoothMixWan2214BI2V_t2vLowV40.safetensors' }, i2v: { high: 'smoothMixWan2214BI2V_i2vV20High.safetensors', low: 'smoothMixWan2214BI2V_i2vV20Low.safetensors' } },
  textEncoder: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', vae: 'wan_2.1_vae.safetensors',
  loras: [{ id: 'q', name: 'style_high.safetensors', strength: 0.7, on: true, expert: 'high' }],
  width: 480, height: 832, length: 49, fps: 24, steps: 30, cfg: 4, sampler: 'dpmpp_2m', scheduler: 'sgm_uniform', shift: 5, switchStep: 12,
  seed: 123456, randomizeSeed: false, fast: true, fastLoras: defaultVideoSettings().fastLoras, speedInside: {},
  upscale: { on: true, method: 'model', model: '2xNomosUni_span_multijpg.safetensors', scale: 2, resizeMethod: 'lanczos' },
};

/** What `buildWanGraph` made for OLD_SAVED before any of the new fields existed (kept verbatim). */
function legacyGraph(s, startImage) {
  const g = {};
  const node = (id, class_type, inputs, title) => { g[id] = { class_type, inputs, ...(title ? { _meta: { title } } : {}) }; return [id, 0]; };
  const files = s.models[s.mode];
  const steps = s.fast ? 4 : s.steps, switchAt = s.fast ? 2 : s.switchStep, cfg = s.fast ? 1 : s.cfg;
  const expert = (which, id) => {
    const file = files[which];
    let model = node(id, 'UNETLoader', { unet_name: file, weight_dtype: 'default' }, which === 'high' ? 'High-noise model' : 'Low-noise model');
    if (s.fast && !/smoothmixwan.*t2v/i.test(file)) model = node(`${id}f`, 'LoraLoaderModelOnly', { model, lora_name: s.fastLoras[s.mode][which], strength_model: 1 }, 'lightx2v 4-step');
    s.loras.forEach((l, i) => { if (l.on && (l.expert === 'both' || l.expert === which)) model = node(`${id}l${i}`, 'LoraLoaderModelOnly', { model, lora_name: l.name, strength_model: l.strength }); });
    return node(`${id}s`, 'ModelSamplingSD3', { model, shift: s.shift });
  };
  const high = expert('high', '1'), low = expert('low', '2');
  const clip = node('3', 'CLIPLoader', { clip_name: s.textEncoder, type: 'wan', device: 'default' });
  const vae = node('4', 'VAELoader', { vae_name: s.vae });
  node('7', 'CLIPTextEncode', { text: s.positive, clip }, 'Positive');
  node('8', 'CLIPTextEncode', { text: s.negative, clip }, 'Negative');
  const image = node('9', 'LoadImage', { image: startImage }, 'Start image');
  node('10', 'WanImageToVideo', { positive: ['7', 0], negative: ['8', 0], vae, width: s.width, height: s.height, length: s.length, batch_size: 1, start_image: image });
  const sample = (id, model, first, from, title) => node(id, 'KSamplerAdvanced', {
    model, add_noise: first ? 'enable' : 'disable', noise_seed: s.seed, steps, cfg, sampler_name: s.sampler, scheduler: s.scheduler,
    positive: ['10', 0], negative: ['10', 1], latent_image: from, start_at_step: first ? 0 : switchAt, end_at_step: first ? switchAt : 10000,
    return_with_leftover_noise: first ? 'enable' : 'disable',
  }, title);
  const done = sample('12', low, false, sample('11', high, true, ['10', 2], 'High noise'), 'Low noise');
  const frames = node('13', 'VAEDecode', { samples: done, vae });
  const um = node('16m', 'UpscaleModelLoader', { model_name: s.upscale.model }, 'Upscale model');
  const big = node('16x', 'ImageUpscaleWithModel', { upscale_model: um, image: frames });
  const up = node('16', 'ImageScale', { image: big, upscale_method: 'lanczos', width: 960, height: 1664, crop: 'disabled' }, 'Upscale');
  const video = node('14', 'CreateVideo', { images: up, fps: s.fps });
  node('15', 'SaveVideo', { video, filename_prefix: 'video/ImageLab_I2V', format: 'mp4', codec: 'h264' });
  return g;
}

test('old saved settings load with every new field at its default and build the very same graph', () => {
  const s = loadVideoSettings(OLD_SAVED);
  const d = defaultVideoSettings();
  for (const k of ['cfgLow', 'shiftLow', 'weightDtype', 'fastRecipe', 'guidance', 'speedups', 'longClip', 'colorMatch', 'interpolate', 'encode']) {
    assert.deepEqual(plain(s[k]), plain(d[k]), k);
  }
  assert.equal(s.endImage, '');
  assert.deepEqual(plain(buildWanGraph(s, 'clip/a.png [input]')), legacyGraph(OLD_SAVED, 'clip/a.png [input]'));
  // Fast off: the same, through the legacy path again.
  const slow = { ...OLD_SAVED, fast: false };
  assert.deepEqual(plain(buildWanGraph(loadVideoSettings(slow), 'clip/a.png [input]')), legacyGraph(slow, 'clip/a.png [input]'));
  // Defaults alone: the graph the old defaults made.
  assert.deepEqual(plain(buildWanGraph(loadVideoSettings({}), null)), plain(buildWanGraph(defaultVideoSettings(), null)));
  // Garbage in: defaults out; a half-saved nested object keeps its known keys.
  assert.deepEqual(plain(loadVideoSettings(null)), plain(d));
  assert.deepEqual(plain(loadVideoSettings({ encode: { crf: 18 }, guidance: { nag: { on: true } } }).encode), { container: 'mp4', codec: 'h264', crf: 18 });
  assert.deepEqual(plain(loadVideoSettings({ guidance: { nag: { on: true } } }).guidance), { cfgZeroStar: false, nag: { on: true, scale: 11, alpha: 0.25, tau: 2.5 } });
});

test('per-expert CFG and shift, the weight dtype and a per-expert LoRA strength', () => {
  const s = { ...defaultVideoSettings(), fast: false, positive: 'x', cfg: 4, cfgLow: 2.5, shift: 8, shiftLow: 5, weightDtype: 'fp8_e4m3fn_fast',
    loras: [{ id: 'a', name: 'style.safetensors', strength: 1, on: true, expert: 'both', strengthLow: 0.6 }] };
  const g = plain(buildWanGraph(s));
  assert.deepEqual([g['11'].inputs.cfg, g['12'].inputs.cfg], [4, 2.5]);
  assert.deepEqual([g['1s'].inputs.shift, g['2s'].inputs.shift], [8, 5]);
  assert.equal(g['1'].inputs.weight_dtype, 'fp8_e4m3fn_fast');
  assert.deepEqual([g['1l0'].inputs.strength_model, g['2l0'].inputs.strength_model], [1, 0.6]);
  // null means "same as the high expert"; Fast ignores cfgLow.
  const same = plain(buildWanGraph({ ...s, cfgLow: null, shiftLow: null }));
  assert.deepEqual([same['12'].inputs.cfg, same['2s'].inputs.shift], [4, 8]);
  assert.equal(plain(buildWanGraph({ ...s, fast: true }))['12'].inputs.cfg, 1);
  assert.deepEqual(plain(effectiveSampling(s)), { steps: 20, switchStep: 10, cfg: 4, cfgLow: 2.5, motionSteps: 0, motionCfg: 3.5 });
});

test('the Fast recipe is adjustable: its own steps, switch, CFG and lightx2v strengths', () => {
  const s = { ...defaultVideoSettings(), mode: 'i2v', positive: 'x', fastRecipe: { steps: 6, switchStep: 3, cfg: 1, strengthHigh: 0.8, strengthLow: 1, motionSteps: 0, motionCfg: 3.5 } };
  const g = plain(buildWanGraph(s, 'a.png'));
  assert.deepEqual([g['11'].inputs.steps, g['11'].inputs.end_at_step, g['12'].inputs.start_at_step, g['11'].inputs.cfg], [6, 3, 3, 1]);
  assert.deepEqual([g['1f'].inputs.strength_model, g['2f'].inputs.strength_model], [0.8, 1]);
  assert.equal(g['11p'], undefined);
  // An old saved recipe without the motion fields loads with them off.
  const old = loadVideoSettings({ fastRecipe: { steps: 6, switchStep: 3, cfg: 1, strengthHigh: 0.8, strengthLow: 1 } });
  assert.deepEqual(plain(old.fastRecipe), { steps: 6, switchStep: 3, cfg: 1, strengthHigh: 0.8, strengthLow: 1, motionSteps: 0, motionCfg: 3.5 });
});

test('motion pass: the first Fast steps run the high expert without the speed LoRA at a real CFG', () => {
  const d = defaultVideoSettings();
  const s = { ...d, positive: 'x', mode: 'i2v', fastRecipe: { ...d.fastRecipe, steps: 8, switchStep: 4, motionSteps: 2, motionCfg: 3 },
    loras: [{ id: 'a', name: 'style_high.safetensors', strength: 0.5, on: true, expert: 'high' }], guidance: { ...d.guidance, cfgZeroStar: true } };
  const g = plain(buildWanGraph(s, 'a.png'));
  // The plain chain hangs off the same loader: the user's LoRA, the shift and the patches, no lightx2v.
  assert.deepEqual(g['1pl0'].inputs, { model: ['1', 0], lora_name: 'style_high.safetensors', strength_model: 0.5 });
  assert.deepEqual(g['1ps'].inputs, { model: ['1pl0', 0], shift: 8 });
  assert.deepEqual(g['1pc'].inputs, { model: ['1ps', 0] });
  assert.equal(g['1pf'], undefined);
  assert.deepEqual(g['1l0'].inputs.model, ['1f', 0]);
  const p = g['11p'].inputs, h = g['11'].inputs, l = g['12'].inputs;
  assert.deepEqual([p.model, p.add_noise, p.start_at_step, p.end_at_step, p.cfg, p.return_with_leftover_noise, p.steps], [['1pc', 0], 'enable', 0, 2, 3, 'enable', 8]);
  assert.deepEqual([h.model, h.add_noise, h.start_at_step, h.end_at_step, h.cfg, h.latent_image, h.return_with_leftover_noise], [['1c', 0], 'disable', 2, 4, 1, ['11p', 0], 'enable']);
  assert.deepEqual([l.start_at_step, l.latent_image, l.return_with_leftover_noise], [4, ['11', 0], 'disable']);
  // Up to the switch: the lightx2v high sampler is skipped and the low expert takes the pass directly.
  const all = plain(buildWanGraph({ ...s, fastRecipe: { ...s.fastRecipe, motionSteps: 9 } }, 'a.png'));
  assert.equal(all['11'], undefined);
  assert.deepEqual([all['11p'].inputs.end_at_step, all['12'].inputs.latent_image], [4, ['11p', 0]]);
  // Fast off ignores the motion pass; the estimate sees the real CFG and the extra sampler.
  assert.equal(plain(buildWanGraph({ ...s, fast: false }, 'a.png'))['11p'], undefined);
  const shape = plain(wanRunShape(g));
  assert.deepEqual([shape.steps, shape.cfg], [8, 3]);
  assert.equal(plain(wanRunTiming(g, { '11p': 500, '11': 500, '12': 1000 }, 1)).samplingMs, 2000);
});

test('an end image switches image to video to WanFirstLastFrameToVideo with the same outputs', () => {
  const s = { ...defaultVideoSettings(), mode: 'i2v', positive: 'x', endImage: 'clip/end.png' };
  const g = plain(buildWanGraph(s, 'clip/start.png'));
  assert.equal(g['10'].class_type, 'WanFirstLastFrameToVideo');
  assert.deepEqual([g['10'].inputs.start_image, g['10'].inputs.end_image], [['9', 0], ['9e', 0]]);
  assert.equal(g['9e'].inputs.image, 'clip/end.png');
  assert.deepEqual([g['11'].inputs.positive, g['11'].inputs.latent_image], [['10', 0], ['10', 2]]);
  // Text to video ignores it.
  assert.equal(plain(buildWanGraph({ ...s, mode: 't2v' }))['9e'], undefined);
});

test('guidance and speedup patches chain after the shift on both experts, in a fixed order', () => {
  const d = defaultVideoSettings();
  const s = { ...d, positive: 'x', length: 161, mode: 'i2v',
    guidance: { cfgZeroStar: true, nag: { on: true, scale: 7, alpha: 0.4, tau: 2 } },
    speedups: { easyCache: { on: true, threshold: 0.3, startPercent: 0.1, endPercent: 0.9 }, torchCompile: true },
    longClip: { on: true, windowFrames: 81, overlapFrames: 20 } };
  const g = plain(buildWanGraph(s, 'a.png'));
  for (const id of ['1', '2']) {
    assert.deepEqual(g[`${id}t`], { class_type: 'TorchCompileModel', inputs: { model: [`${id}s`, 0], backend: 'inductor' }, _meta: { title: 'torch.compile' } });
    assert.deepEqual(g[`${id}c`].inputs, { model: [`${id}t`, 0] });
    assert.deepEqual(g[`${id}n`], { class_type: 'WanVideoNAG', inputs: { model: [`${id}c`, 0], conditioning: ['8', 0], nag_scale: 7, nag_alpha: 0.4, nag_tau: 2 }, _meta: { title: 'NAG' } });
    assert.deepEqual(g[`${id}e`].inputs, { model: [`${id}n`, 0], reuse_threshold: 0.3, start_percent: 0.1, end_percent: 0.9, verbose: false });
    assert.deepEqual(g[`${id}w`].inputs, { model: [`${id}e`, 0], context_length: 81, context_overlap: 20, context_schedule: 'static_standard', context_stride: 1,
      closed_loop: false, fuse_method: 'pyramid', freenoise: true, retain_first_frame: true, split_conds_to_windows: false });
  }
  assert.deepEqual([g['11'].inputs.model, g['12'].inputs.model], [['1w', 0], ['2w', 0]]);
  // Each off: no node, the sampler reads the shift directly.
  const off = plain(buildWanGraph({ ...d, positive: 'x' }));
  for (const id of ['1t', '1c', '1n', '1e', '1w']) assert.equal(off[id], undefined);
  // NAG at scale 0 is the node's own no-op: leave it out.
  assert.equal(plain(buildWanGraph({ ...d, positive: 'x', guidance: { ...d.guidance, nag: { ...d.guidance.nag, on: true, scale: 0 } } }))['1n'], undefined);
  assert.deepEqual(off['11'].inputs.model, ['1s', 0]);
  // The window never exceeds the clip; a T2V clip does not retain a first frame.
  const w = plain(buildWanGraph({ ...d, positive: 'x', length: 49, longClip: { on: true, windowFrames: 81, overlapFrames: 60 } }));
  assert.deepEqual([w['1w'].inputs.context_length, w['1w'].inputs.context_overlap, w['1w'].inputs.retain_first_frame], [49, 48, false]);
});

test('finish: colour match to the start frame, RIFE interpolation after the upscale, fps multiplied', () => {
  const d = defaultVideoSettings();
  const s = { ...d, positive: 'x', mode: 'i2v', length: 81, fps: 16,
    colorMatch: { on: true, method: 'hm-mvgd-hm', strength: 0.8 },
    upscale: { ...d.upscale, on: true },
    interpolate: { on: true, model: 'rife_v4.26.safetensors', multiplier: 2 } };
  const g = plain(buildWanGraph(s, 'a.png'));
  assert.deepEqual(g['13m'].inputs, { image_target: ['13', 0], image_ref: ['9', 0], method: 'hm-mvgd-hm', strength: 0.8, multithread: true });
  assert.deepEqual(g['16x'].inputs.image, ['13m', 0]);
  assert.deepEqual(g['17m'], { class_type: 'FrameInterpolationModelLoader', inputs: { model_name: 'rife_v4.26.safetensors' }, _meta: { title: 'Interpolation model' } });
  assert.deepEqual(g['17'].inputs, { interp_model: ['17m', 0], images: ['16', 0], multiplier: 2 });
  assert.deepEqual([g['14'].inputs.images, g['14'].inputs.fps], [['17', 0], 32]);
  assert.deepEqual(plain(outputFrames(s)), { frames: 161, fps: 32 });
  // Colour match only has a reference in image to video; strength 0 adds nothing.
  assert.equal(plain(buildWanGraph({ ...s, mode: 't2v' }))['13m'], undefined);
  assert.equal(plain(buildWanGraph({ ...s, colorMatch: { ...s.colorMatch, strength: 0 } }, 'a.png'))['13m'], undefined);
  // The estimate sees the interpolated frame count in the output, not in the sampling.
  const shape = plain(wanRunShape(g));
  assert.deepEqual([shape.frames, shape.outFrames, shape.outWidth], [81, 161, 1664]);
  const t = plain(wanRunTiming(g, { '11': 1000, '12': 1000, '13': 100, '13m': 200, '16x': 300, '16': 50, '17m': 10, '17': 500, '14': 100, '15': 100, '1': 2000 }, 1));
  assert.deepEqual([t.samplingMs, t.upscaleMs, t.finishMs, t.loadMs], [2000, 300, 1060, 2000]);
  assert.equal(t.outUnits, 1664 * 960 * 161 / 1e9);
});

test('encode: the default is the plain mp4/h264 pair; a CRF goes through the dotted dynamic-combo keys', () => {
  assert.deepEqual(plain(saveVideoInputs(undefined)), { format: 'mp4', codec: 'h264' });
  assert.deepEqual(plain(saveVideoInputs({ container: 'mp4', codec: 'h264', crf: null })), { format: 'mp4', codec: 'h264' });
  assert.deepEqual(plain(saveVideoInputs({ container: 'mkv', codec: 'av1', crf: 28 })),
    { format: 'mkv', 'format.codec': 'av1', 'format.codec.encoding': 're-encode', 'format.codec.encoding.crf': 28 });
  // WebM takes AV1 only; the CRF is clamped to the codec's range.
  assert.deepEqual(plain(saveVideoInputs({ container: 'webm', codec: 'h264', crf: 99 })),
    { format: 'webm', 'format.codec': 'av1', 'format.codec.encoding': 're-encode', 'format.codec.encoding.crf': 63 });
  const g = plain(buildWanGraph({ ...defaultVideoSettings(), positive: 'x', encode: { container: 'mp4', codec: 'h264', crf: 18 } }));
  assert.deepEqual(g['15'].inputs, { video: ['14', 0], filename_prefix: 'video/ImageLab_T2V', format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 're-encode', 'format.codec.encoding.crf': 18 });
});
