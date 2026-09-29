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
