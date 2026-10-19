const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
// h3Graph / videoSections / videoSweep / videoPresets import wanGraph (which imports nothing), so
// `require` here loads each from source.
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Math, require: (p) => load(p.replace(/^\.\//, '')) });
  return exports;
}
const wan = load('wanGraph');
const { buildH3Graph, buildVideoGraph, pickInstalledH3Files, h3ModelFile } = load('h3Graph');
const { defaultVideoSettings, loadVideoSettings, h3Length, h3Side, h3TurboStepsOf, videoHasAudio, isH3Name, isVideoModelName, outputFrames, wanRunShape, wanRunTiming } = wan;
const plain = (v) => JSON.parse(JSON.stringify(v));
const classes = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.class_type]));

/** Settings on the H3 engine with a prompt. */
const h3 = (patch = {}, h3patch = {}) => {
  const s = { ...defaultVideoSettings(), engine: 'h3', positive: 'a fox walks through rain. Audio: rain, soft steps', seed: 7, ...patch };
  s.h3 = { ...s.h3, ...h3patch };
  return s;
};

test('the frame grid and canvas snap like the node: 17k + 5 frames, sides of 32', () => {
  assert.equal(h3Length(124), 124);
  assert.equal(h3Length(120), 124);
  assert.equal(h3Length(125), 141);
  assert.equal(h3Length(1), 5);
  assert.equal(h3Side(870), 864);
  assert.equal(h3Side(10), 32);
  assert.equal(h3TurboStepsOf('minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors'), 8);
  assert.equal(h3TurboStepsOf('minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors'), 4);
  assert.equal(h3TurboStepsOf('style.safetensors'), null);
});

test('text to video: one model through the sigma shift, KSampler at CFG 1 with a zeroed negative, video + audio decoded and muxed at 24 fps', () => {
  const g = plain(buildH3Graph(h3()));
  const c = classes(g);
  assert.equal(c['1'], 'UNETLoader');
  assert.equal(g['1'].inputs.unet_name, 'minimax_h3_fl2va_pruned_int8_convrot.safetensors');
  assert.equal(c['1f'], undefined, 'turbo is off by default');
  assert.deepEqual(g['1s'], { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['1', 0], shift_video: 12, shift_audio: 3 }, _meta: { title: 'Sigma shift' } });
  assert.deepEqual(g['3'].inputs, { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' });
  assert.equal(g['4'].inputs.vae_name, 'minimax_h3_video_vae_fp16.safetensors');
  assert.equal(g['4a'].inputs.vae_name, 'minimax_h3_audio_vae_fp32.safetensors');
  assert.equal(c['10'], 'MiniMaxH3ImageToVideo');
  assert.deepEqual(g['10'].inputs, { clip: ['3', 0], vae: ['4', 0], prompt: 'a fox walks through rain. Audio: rain, soft steps', width: 864, height: 480, length: 124 });
  assert.deepEqual(g['8'], { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['10', 0] }, _meta: { title: 'No negative' } });
  const k = g['11'].inputs;
  assert.equal(g['11'].class_type, 'KSampler');
  assert.deepEqual([k.model, k.seed, k.steps, k.cfg, k.sampler_name, k.scheduler, k.positive, k.negative, k.latent_image, k.denoise],
    [['1s', 0], 7, 20, 1, 'res_multistep', 'simple', ['10', 0], ['8', 0], ['10', 1], 1]);
  assert.deepEqual(g['13'].inputs, { samples: ['11', 0], vae: ['4', 0] });
  assert.deepEqual(g['13a'], { class_type: 'VAEDecodeAudio', inputs: { samples: ['11', 0], vae: ['4a', 0] }, _meta: { title: 'Decode audio' } });
  assert.deepEqual(g['14'].inputs, { images: ['13', 0], fps: 24, audio: ['13a', 0] });
  assert.deepEqual(g['15'].inputs, { video: ['14', 0], filename_prefix: 'video/ImageLab_H3_T2V', format: 'mp4', codec: 'h264' });
  assert.equal(g['9'], undefined);
  // No Wan node anywhere.
  for (const cls of Object.values(c)) assert.doesNotMatch(cls, /Wan|ModelSamplingSD3|KSamplerAdvanced|EmptyHunyuan/);
});

test('audio off drops the audio VAE, its decode and the mux input', () => {
  const g = plain(buildH3Graph(h3({}, { audio: false })));
  assert.equal(g['4a'], undefined);
  assert.equal(g['13a'], undefined);
  assert.deepEqual(g['14'].inputs, { images: ['13', 0], fps: 24 });
});

test('first frame, and first + last frame, feed MiniMaxH3ImageToVideo; the Wan start image is untouched', () => {
  const one = plain(buildH3Graph(h3({}, { mode: 'i2v' }), 'imagelab/start.png'));
  assert.equal(one['9'].inputs.image, 'imagelab/start.png');
  assert.deepEqual(one['10'].inputs.first_frame, ['9', 0]);
  assert.equal(one['10'].inputs.last_frame, undefined);
  assert.equal(one['15'].inputs.filename_prefix, 'video/ImageLab_H3_I2V');
  const two = plain(buildH3Graph(h3({ endImage: 'imagelab/end.png' }, { mode: 'i2v' }), 'imagelab/start.png'));
  assert.deepEqual(two['9e'].inputs, { image: 'imagelab/end.png' });
  assert.deepEqual(two['10'].inputs.last_frame, ['9e', 0]);
  // Colour match back to the first frame, as Wan's i2v has it.
  const cm = plain(buildH3Graph(h3({ colorMatch: { on: true, method: 'mkl', strength: 1 } }, { mode: 'i2v' }), 'imagelab/start.png'));
  assert.deepEqual(cm['13m'].inputs.image_ref, ['9', 0]);
  assert.deepEqual(cm['14'].inputs.images, ['13m', 0]);
});

test('reference pictures: the ref2va model, the audio VAE always, autogrow keys ref_images.ref_image_N', () => {
  const s = h3({}, { mode: 'ref', refImages: ['imagelab/a.png', '', 'imagelab/b.png'], audio: false, refImageSize: 'max' });
  const g = plain(buildH3Graph(s));
  assert.equal(g['1'].inputs.unet_name, 'minimax_h3_ref2va_pruned_int8_convrot.safetensors');
  assert.equal(g['10'].class_type, 'MiniMaxH3ReferenceToVideo');
  assert.deepEqual(g['10'].inputs, {
    clip: ['3', 0], vae: ['4', 0], audio_vae: ['4a', 0], prompt: s.positive, width: 864, height: 480, length: 124, ref_image_size: 'max',
    'ref_images.ref_image_0': ['9r0', 0], 'ref_images.ref_image_1': ['9r1', 0],
  });
  assert.deepEqual([g['9r0'].inputs.image, g['9r1'].inputs.image], ['imagelab/a.png', 'imagelab/b.png']);
  assert.equal(g['13a'], undefined, 'audio off: the audio VAE loads for the references only');
  assert.equal(g['15'].inputs.filename_prefix, 'video/ImageLab_H3_REF');
});

test('turbo: the LoRA of the task first on the model, its own step count; user LoRAs after it; VRAM patches last', () => {
  const s = h3({}, {
    turbo: { on: true, lora: 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors', steps: 8, loraRef: 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors', stepsRef: 4, strength: 0.8 },
    loras: [{ id: 'a', name: 'style.safetensors', strength: 0.7, on: true }, { id: 'b', name: 'off.safetensors', strength: 1, on: false }],
    lowVram: { attention: true, headChunks: 4, feedForward: true, chunks: 2 },
    steps: 20,
  });
  const g = plain(buildH3Graph(s));
  assert.deepEqual(g['1f'].inputs, { model: ['1', 0], lora_name: 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors', strength_model: 0.8 });
  assert.deepEqual(g['1l0'].inputs, { model: ['1f', 0], lora_name: 'style.safetensors', strength_model: 0.7 });
  assert.equal(g['1l1'], undefined);
  assert.deepEqual(g['1s'].inputs.model, ['1l0', 0]);
  assert.deepEqual(g['1a'].inputs, { model: ['1s', 0], head_chunks: 4 });
  assert.deepEqual(g['1k'].inputs, { model: ['1a', 0], chunks: 2, seq_threshold: 4096 });
  assert.deepEqual(g['11'].inputs.model, ['1k', 0]);
  assert.equal(g['11'].inputs.steps, 8);
  const ref = plain(buildH3Graph({ ...s, h3: { ...s.h3, mode: 'ref', refImages: ['imagelab/a.png'] } }));
  assert.equal(ref['1f'].inputs.lora_name, 'minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors');
  assert.equal(ref['11'].inputs.steps, 4);
});

test('sizes and lengths snap; the shared upscale, interpolation and encode apply to H3 frames too', () => {
  const s = h3({
    upscale: { on: true, method: 'model', model: '2xNomosUni_span_multijpg.safetensors', scale: 2, resizeMethod: 'lanczos' },
    interpolate: { on: true, model: 'rife_v4.26.safetensors', multiplier: 2 },
    encode: { container: 'mp4', codec: 'h264', crf: 18 },
  }, { width: 870, height: 470, length: 120, cfg: 2.5, shiftVideo: 10, shiftAudio: 2 });
  const g = plain(buildH3Graph(s));
  assert.deepEqual([g['10'].inputs.width, g['10'].inputs.height, g['10'].inputs.length], [864, 480, 124]);
  assert.equal(g['11'].inputs.cfg, 2.5);
  assert.deepEqual([g['1s'].inputs.shift_video, g['1s'].inputs.shift_audio], [10, 2]);
  assert.deepEqual(g['16x'].inputs.image, ['13', 0]);
  assert.deepEqual([g['16'].inputs.width, g['16'].inputs.height], [1728, 960]);
  assert.deepEqual(g['17'].inputs.images, ['16', 0]);
  assert.deepEqual(g['14'].inputs, { images: ['17', 0], fps: 48, audio: ['13a', 0] });
  assert.equal(g['15'].inputs['format.codec.encoding.crf'], 18);
  assert.deepEqual(plain(outputFrames(s)), { frames: 247, fps: 48 });
});

test('the run shape and timing read an H3 graph through the Wan node ids', () => {
  const g = plain(buildH3Graph(h3({}, { turbo: { ...defaultVideoSettings().h3.turbo, on: true } })));
  const shape = wanRunShape(g);
  assert.deepEqual([shape.width, shape.height, shape.frames, shape.steps, shape.cfg, shape.outWidth, shape.outHeight], [864, 480, 124, 8, 1, 864, 480]);
  assert.match(shape.modelsKey, /minimax_h3_fl2va_pruned_int8_convrot/);
  assert.match(shape.modelsKey, /turbo_8step/);
  const t = wanRunTiming(g, { 1: 5000, 11: 60000, 13: 3000, '13a': 1000, 14: 2000, 15: 500 }, 1);
  assert.equal(t.samplingMs, 60000);
  assert.equal(t.finishMs, 6500);
  assert.equal(t.loadMs, 5000);
});

test('buildVideoGraph picks the engine; old saves are Wan with H3 defaults filled in', () => {
  const old = loadVideoSettings({ mode: 't2v', positive: 'x', width: 832, height: 480, length: 81, fps: 16, fast: true });
  assert.equal(old.engine, 'wan');
  assert.equal(old.h3.length, 124);
  assert.equal(old.h3.models.fl2va, 'minimax_h3_fl2va_pruned_int8_convrot.safetensors');
  assert.equal(plain(buildVideoGraph(old))['10'].class_type, 'EmptyHunyuanLatentVideo');
  assert.equal(plain(buildVideoGraph(h3()))['10'].class_type, 'MiniMaxH3ImageToVideo');
  // A partial saved h3 block keeps the rest at defaults.
  const part = loadVideoSettings({ engine: 'h3', h3: { mode: 'ref', turbo: { on: true }, refImages: ['a.png', 3, null] } });
  assert.equal(part.engine, 'h3');
  assert.equal(part.h3.turbo.steps, 8);
  assert.deepEqual(plain(part.h3.refImages), ['a.png']);
  assert.equal(part.h3.lowVram.headChunks, 4);
});

test('installed H3 files fill in for missing ones, only when the choice is clear', () => {
  const server = {
    diffusionModels: ['wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors', 'minimax_h3_fl2va_pruned_bf16.safetensors', 'minimax_h3_ref2va_pruned_bf16.safetensors'],
    textEncoders: ['umt5_xxl_fp8_e4m3fn_scaled.safetensors', 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors'],
    vaes: ['wan_2.1_vae.safetensors', 'minimax_h3_video_vae_int8_convrot.safetensors', 'minimax_h3_audio_vae_fp32.safetensors'],
  };
  const p = plain(pickInstalledH3Files(defaultVideoSettings().h3, server));
  assert.deepEqual(p, {
    models: { fl2va: 'minimax_h3_fl2va_pruned_bf16.safetensors', ref2va: 'minimax_h3_ref2va_pruned_bf16.safetensors' },
    textEncoder: 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors',
    videoVae: 'minimax_h3_video_vae_int8_convrot.safetensors',
  });
  // Two candidates: leave it.
  const two = { ...server, textEncoders: [...server.textEncoders, 'qwen3vl_32b_minimax_h3_bf16.safetensors'] };
  assert.equal(plain(pickInstalledH3Files(defaultVideoSettings().h3, two)).textEncoder, undefined);
  assert.equal(h3ModelFile({ ...defaultVideoSettings().h3, mode: 'ref' }), 'minimax_h3_ref2va_pruned_int8_convrot.safetensors');
});

test('names: H3 files stay out of the image pickers; H3 clips are the ones with sound', () => {
  assert.equal(isH3Name('minimax_h3_fl2va_pruned_int8_convrot.safetensors'), true);
  assert.equal(isH3Name('qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'), true);
  assert.equal(isH3Name('anima_turboV11.safetensors'), false);
  assert.equal(isVideoModelName('smoothMixWan2214BI2V_t2vHighV40.safetensors'), true);
  assert.equal(isVideoModelName('minimax_h3_ref2va_bf16.safetensors'), true);
  assert.equal(videoHasAudio('http://pod/view?filename=ImageLab_H3_T2V_00001_.mp4&subfolder=video&type=output'), true);
  assert.equal(videoHasAudio('ImageLab_T2V_00001_.mp4'), false);
  assert.equal(videoHasAudio('http://pod/view?filename=ImageLab%5FH3%5FREF%5F00002%5F.mp4'), true);
});

test('sections: H3 missing files by section, summaries, and the Wan ones unchanged', () => {
  const sec = load('videoSections');
  const v = { ...h3({}, { turbo: { ...defaultVideoSettings().h3.turbo, on: true } }), startImage: '' };
  const none = { models: ['x'], diffusionModels: [], textEncoders: [], vaes: [], loras: [], upscaleModels: [], interpolationModels: [] };
  const by = sec.missingVideoFilesBySection(v, none);
  assert.deepEqual([...by.models], ['minimax_h3_fl2va_pruned_int8_convrot.safetensors', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', 'minimax_h3_video_vae_fp16.safetensors', 'minimax_h3_audio_vae_fp32.safetensors']);
  assert.deepEqual([...by.speed], ['minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors']);
  // Silent text clip: no audio VAE needed.
  const silent = sec.missingVideoFilesBySection({ ...v, h3: { ...v.h3, audio: false, turbo: { ...v.h3.turbo, on: false } } }, none);
  assert.deepEqual([...silent.models].length, 3);
  assert.deepEqual([...silent.speed], []);
  const full = {
    models: ['x'], diffusionModels: [v.h3.models.fl2va, v.h3.models.ref2va], textEncoders: [v.h3.textEncoder], vaes: [v.h3.videoVae, v.h3.audioVae],
    loras: [v.h3.turbo.lora], upscaleModels: [], interpolationModels: [],
  };
  const st = sec.videoSectionStatus(v, full);
  assert.equal(st.mode.summary, 'MiniMax H3 · Text → Video');
  assert.equal(st.size.summary, '864 × 480 · 124 frames · 5.2 s · stereo audio');
  assert.equal(st.speed.summary, 'Turbo · 8 steps');
  assert.equal(st.speed.badge, 'turbo');
  assert.equal(st.guidance.summary, 'No VRAM patches');
  assert.match(st.models.summary, /minimax_h3_fl2va_pruned_int8_convrot · qwen3vl_32b_minimax_h3_nvfp4_awq/);
  const ref = sec.videoSectionStatus({ ...v, h3: { ...v.h3, mode: 'ref' } }, full);
  assert.equal(ref.mode.tone, 'warn');
  assert.equal(sec.videoSectionStatus({ ...v, h3: { ...v.h3, mode: 'ref', refImages: ['a.png', 'b.png'] } }, full).mode.summary, 'MiniMax H3 · Reference → Video · 2 pictures');
  assert.equal(sec.videoSeconds(v), '5.2');
  assert.equal(sec.videoSeconds({ length: 81, fps: 16 }), '5.1');
  // Wan summaries are what they were.
  const wanV = { ...defaultVideoSettings(), positive: 'x', startImage: '' };
  assert.equal(sec.videoSectionStatus(wanV, none).mode.summary, 'Text → Video');
});

test('sweeps and presets on the H3 engine', () => {
  const sw = load('videoSweep');
  const pr = load('videoPresets');
  const base = h3({}, { refImages: ['a.png'] });
  assert.ok(sw.sweepAxesFor('h3').some((a) => a.id === 'audioShift'));
  assert.ok(!sw.sweepAxesFor('h3').some((a) => a.id === 'motionSteps'));
  assert.ok(!sw.sweepAxesFor('wan').some((a) => a.id === 'audioShift'));
  const steps = sw.sweepItems(base, 'steps', 12, 20, 3);
  assert.deepEqual(plain(steps.map((i) => i.patch.h3.steps)), [12, 16, 20]);
  assert.equal(steps[0].patch.h3.turbo.on, false);
  assert.deepEqual(plain(sw.sweepItems(base, 'length', 73, 124, 2).map((i) => i.patch.h3.length)), [73, 124]);
  assert.equal(sw.sweepItems(base, 'shift', 8, 12, 2)[1].patch.h3.shiftVideo, 12);
  assert.equal(sw.sweepItems(base, 'cfg', 1, 3, 2)[1].patch.h3.cfg, 3);
  assert.equal(sw.sweepItems(base, 'turboStrength', 0.5, 1, 2)[0].patch.h3.turbo.on, true);
  // A preset keeps the engine and the H3 recipe, never the reference pictures.
  const body = pr.presetBody(base);
  assert.equal(body.engine, 'h3');
  assert.deepEqual(plain(body.h3.refImages), []);
  const applied = pr.applyPreset({ ...defaultVideoSettings(), positive: 'keep', h3: { ...defaultVideoSettings().h3, refImages: ['mine.png'] } }, { settings: body });
  assert.equal(applied.engine, 'h3');
  assert.equal(applied.positive, 'keep');
  assert.deepEqual(plain(applied.h3.refImages), ['mine.png']);
  assert.equal(pr.matchesPreset(base, { settings: body }), true);
});
