// The universal model component's pure layer (rule 4: one model component for ALL models):
// the kind vocabulary, the pending record's home (scope / folder / list), the Video step's
// slot ↔ entry mapping and patches, the Workflow step's loader ↔ entry mapping.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const P = load('src/screens/image/model/pendingLogic.ts');
const S = load('src/screens/image/model/kindSpecs.ts', { './pendingLogic': P });
const V = load('src/screens/image/video/videoKinds.ts', { '../model/kindSpecs': S, '../model/pendingLogic': P });
const WL = load('src/screens/image/workflow/workflowStepLogic.ts');
const W = load('src/screens/image/workflow/workflowKinds.ts', { './workflowStepLogic': WL });

// ── kinds ──────────────────────────────────────────────────────────────────

test('every kind has a spec: list, folder, modal kind; clip and other have no CivitAI mapping', () => {
  assert.deepEqual(S.ALL_KINDS, ['checkpoint', 'lora', 'embedding', 'controlnet', 'vae', 'clip', 'upscale', 'other']);
  assert.deepEqual(S.IMAGE_KINDS, ['checkpoint', 'lora', 'embedding', 'controlnet']);
  for (const k of S.ALL_KINDS) {
    const s = S.KINDS[k];
    assert.equal(s.key, k);
    assert.ok(s.label && s.one && s.list && s.folder, k);
  }
  assert.equal(S.KINDS.vae.pick, 'vae');
  assert.equal(S.KINDS.upscale.pick, 'upscale');
  assert.equal(S.KINDS.clip.pick, null);
  assert.equal(S.KINDS.other.pick, null);
  assert.equal(S.KINDS.vae.list, 'vaes');
  assert.equal(S.KINDS.clip.list, 'textEncoders');
  assert.equal(S.KINDS.clip.folder, 'text_encoders');
  assert.equal(S.KINDS.upscale.folder, 'upscale_models');
  assert.equal(S.KINDS.lora.hasSwitch, true);
  assert.equal(S.KINDS.vae.weight, undefined);
  assert.equal(S.fmtWeight(0.8), '0.8');
  assert.equal(S.fmtWeight(1.25), '1.25');
  const x = S.specWith('checkpoint', { label: 'Experts', weight: undefined, list: 'diffusionModels' });
  assert.equal(x.key, 'checkpoint');
  assert.equal(x.label, 'Experts');
  assert.equal(x.weight, undefined);
  assert.equal(x.list, 'diffusionModels');
  assert.equal(S.KINDS.checkpoint.label, 'Checkpoint', 'specWith never edits the table');
});

// ── pending records for any store ─────────────────────────────────────────

const pick = (file = 'wan2.2_high.safetensors', over = {}) => ({
  installed: false, file: null,
  model: { id: 5, name: 'Wan High', type: 'Checkpoint', baseModel: 'Wan Video 2.2 T2V-A14B' },
  version: { id: 50, name: 'v1', trainedWords: [], file: { name: file } }, ...over,
});

test('a record remembers its scope, folder and list; reconcile reads the record\'s list first', () => {
  const r = P.recordFromPick('checkpoint', pick(), 1, 'wan:high', true, 1, { scope: 'video', folder: 'diffusion_models', list: 'diffusionModels' });
  assert.equal(r.key, 'checkpoint:wan2.2_high.safetensors');
  assert.equal(r.scope, 'video');
  assert.equal(P.recordFolder(r), 'diffusion_models');
  const plain = P.recordFromPick('checkpoint', pick(), 1);
  assert.equal(plain.scope, undefined);
  assert.equal(P.recordFolder(plain), 'checkpoints');
  // Listed under checkpoints only: the video record waits (its list is diffusionModels), the image one lands.
  const lists = { checkpoint: ['wan2.2_high.safetensors'], diffusionModels: [] };
  assert.equal(P.reconcile([r], lists).waiting.length, 1);
  assert.equal(P.reconcile([plain], lists).landed.length, 1);
  assert.equal(P.reconcile([r], { checkpoint: [], diffusionModels: ['Wan/wan2.2_high.safetensors'] }).landed[0].file, 'Wan/wan2.2_high.safetensors');
});

test('kind → folder and list for the new kinds', () => {
  assert.deepEqual(['vae', 'clip', 'upscale', 'other'].map(P.folderForKind), ['vae', 'text_encoders', 'upscale_models', 'other']);
  assert.deepEqual(['checkpoint', 'lora', 'vae', 'clip', 'upscale', 'embedding', 'controlnet'].map(P.listForKind), ['models', 'loras', 'vaes', 'textEncoders', 'upscaleModels', 'embeddings', 'controlnets']);
});

test('isMissing: a named file no list carries; never while lists are empty or the name is blank', () => {
  assert.equal(P.isMissing(['a.safetensors'], 'b.safetensors', 'lora'), true);
  assert.equal(P.isMissing(['sub/a.safetensors'], 'A.safetensors', 'lora'), false);
  assert.equal(P.isMissing([], 'b.safetensors', 'lora'), false);
  assert.equal(P.isMissing(['a'], '', 'lora'), false);
  assert.equal(P.isMissing(['easynegative'], 'easynegative.pt', 'embedding'), false);
});

test('sameFile compares base names, case ignored', () => {
  assert.equal(P.sameFile('Wan/x.safetensors', 'X.SAFETENSORS'), true);
  assert.equal(P.sameFile('x.safetensors', 'y.safetensors'), false);
  assert.equal(P.sameFile('', 'y'), false);
  assert.equal(P.sameFile('easy.pt', 'easy', 'embedding'), true);
});

// ── the Video step's slots ────────────────────────────────────────────────

const video = (over = {}) => ({
  engine: 'wan', mode: 't2v',
  models: { t2v: { high: 't2v_high.safetensors', low: 't2v_low.safetensors' }, i2v: { high: 'i2v_high.safetensors', low: 'i2v_low.safetensors' } },
  textEncoder: 'umt5.safetensors', vae: 'wan_2.1_vae.safetensors',
  loras: [{ id: 'L1', name: 'style_high.safetensors', strength: 0.8, on: true, expert: 'high' }, { id: 'L2', name: 'motion.safetensors', strength: 1, on: false, expert: 'both', strengthLow: 0.6 }],
  fast: true, fastLoras: { t2v: { high: 'lx_t2v_high.safetensors', low: 'lx_t2v_low.safetensors' }, i2v: { high: 'lx_i2v_high.safetensors', low: 'lx_i2v_low.safetensors' } },
  h3: {
    mode: 't2v', models: { fl2va: 'h3_fl2va.safetensors', ref2va: 'h3_ref2va.safetensors' }, textEncoder: 'qwen3vl.safetensors', videoVae: 'h3_video_vae.safetensors', audioVae: 'h3_audio_vae.safetensors',
    loras: [{ id: 'H1', name: 'h3_style.safetensors', strength: 1, on: true }],
    turbo: { on: false, lora: 'h3_turbo_8.safetensors', loraRef: 'h3_ref_turbo_4.safetensors', strength: 1, steps: 8, stepsRef: 4 },
  },
  ...over,
});

test('video specs and labels per engine', () => {
  assert.deepEqual(V.VIDEO_KINDS, ['checkpoint', 'lora', 'clip', 'vae']);
  const wan = V.videoSpec('wan', 'checkpoint');
  assert.equal(wan.label, 'Experts');
  assert.equal(wan.weight, undefined);
  assert.equal(wan.hasSwitch, false);
  assert.equal(wan.list, 'diffusionModels');
  assert.equal(wan.folder, 'diffusion_models');
  assert.equal(wan.pick, 'checkpoint');
  assert.deepEqual(wan.baseModels, V.WAN_BASE_MODELS);
  assert.equal(V.videoSpec('h3', 'checkpoint').label, 'Model');
  assert.deepEqual(V.videoSpec('h3', 'lora').baseModels, ['MiniMax H3']);
  assert.equal(V.videoSpec('wan', 'lora').hasSwitch, true);
  assert.equal(V.videoSpec('wan', 'clip').pick, null);
  assert.equal(V.videoSpec('wan', 'vae').pick, 'vae');
  assert.deepEqual(V.videoLabels('wan'), { checkpoint: 'Experts', lora: 'LoRAs', clip: 'Text encoder', vae: 'VAE' });
  assert.equal(V.videoLabels('h3').vae, 'VAEs');
});

test('Wan entries: the task\'s two experts badged High / Low, own LoRAs + the Fast pair, UMT5, the VAE', () => {
  const v = video();
  const ck = V.videoEntries(v, 'checkpoint');
  assert.deepEqual(ck.map((e) => [e.id, e.name, e.badge, e.fixed]), [['wan:high', 't2v_high.safetensors', 'High', true], ['wan:low', 't2v_low.safetensors', 'Low', true]]);
  assert.equal(V.videoEntries(video({ mode: 'i2v' }), 'checkpoint')[0].name, 'i2v_high.safetensors');
  const lo = V.videoEntries(v, 'lora');
  assert.deepEqual(lo.map((e) => e.id), ['L1', 'L2', 'wan:fast:high', 'wan:fast:low']);
  assert.equal(lo[0].weight, 0.8);
  assert.equal(lo[0].badge, 'High');
  assert.equal(lo[1].on, false);
  assert.equal(lo[1].badge, undefined);
  assert.equal(lo[2].on, true, 'the Fast pair is on while Fast is');
  assert.equal(lo[2].noWeight, true);
  assert.equal(lo[2].name, 'lx_t2v_high.safetensors');
  assert.deepEqual(V.videoEntries(v, 'clip').map((e) => [e.id, e.name, e.badge]), [['wan:clip', 'umt5.safetensors', 'UMT5']]);
  assert.deepEqual(V.videoEntries(v, 'vae').map((e) => e.id), ['wan:vae']);
  assert.deepEqual(V.videoEntries(v, 'embedding'), []);
});

test('H3 entries: the task\'s model, own LoRAs + Turbo, Qwen3-VL, video + audio VAE', () => {
  const v = video({ engine: 'h3' });
  assert.deepEqual(V.videoEntries(v, 'checkpoint').map((e) => [e.id, e.name]), [['h3:fl2va', 'h3_fl2va.safetensors']]);
  assert.deepEqual(V.videoEntries(video({ engine: 'h3', h3: { ...v.h3, mode: 'ref' } }), 'checkpoint').map((e) => [e.id, e.badge]), [['h3:ref2va', 'Reference']]);
  const lo = V.videoEntries(v, 'lora');
  assert.deepEqual(lo.map((e) => [e.id, e.on, e.badge]), [['H1', true, undefined], ['h3:turbo', false, 'Turbo']]);
  assert.equal(lo[1].name, 'h3_turbo_8.safetensors');
  assert.equal(V.videoEntries(video({ engine: 'h3', h3: { ...v.h3, mode: 'ref' } }), 'lora')[1].name, 'h3_ref_turbo_4.safetensors');
  assert.deepEqual(V.videoEntries(v, 'clip').map((e) => e.badge), ['Qwen3-VL']);
  assert.deepEqual(V.videoEntries(v, 'vae').map((e) => [e.id, e.badge]), [['h3:videoVae', 'Video'], ['h3:audioVae', 'Audio']]);
});

test('videoSlotPatch points a slot or LoRA at a file; unknown ids give null', () => {
  const v = video();
  assert.deepEqual(V.videoSlotPatch(v, 'wan:high', 'new.safetensors').models.t2v, { high: 'new.safetensors', low: 't2v_low.safetensors' });
  assert.deepEqual(V.videoSlotPatch(video({ mode: 'i2v' }), 'wan:low', 'n.safetensors').models.i2v, { high: 'i2v_high.safetensors', low: 'n.safetensors' });
  assert.deepEqual(V.videoSlotPatch(v, 'wan:clip', 'te.safetensors'), { textEncoder: 'te.safetensors' });
  assert.deepEqual(V.videoSlotPatch(v, 'wan:vae', 'v.safetensors'), { vae: 'v.safetensors' });
  assert.equal(V.videoSlotPatch(v, 'wan:fast:low', 'f.safetensors').fastLoras.t2v.low, 'f.safetensors');
  assert.equal(V.videoSlotPatch(v, 'L2', 'other.safetensors').loras[1].name, 'other.safetensors');
  assert.equal(V.videoSlotPatch(v, 'L2', 'other.safetensors').loras[1].strengthLow, 0.6, 'the rest of the LoRA stays');
  const h = video({ engine: 'h3' });
  assert.equal(V.videoSlotPatch(h, 'h3:fl2va', 'm.safetensors').h3.models.fl2va, 'm.safetensors');
  assert.equal(V.videoSlotPatch(h, 'h3:ref2va', 'r.safetensors').h3.models.ref2va, 'r.safetensors');
  assert.equal(V.videoSlotPatch(h, 'h3:clip', 'q.safetensors').h3.textEncoder, 'q.safetensors');
  assert.equal(V.videoSlotPatch(h, 'h3:audioVae', 'a.safetensors').h3.audioVae, 'a.safetensors');
  assert.equal(V.videoSlotPatch(h, 'h3:turbo', 't.safetensors').h3.turbo.lora, 't.safetensors');
  assert.equal(V.videoSlotPatch(video({ engine: 'h3', h3: { ...h.h3, mode: 'ref' } }), 'h3:turbo', 't.safetensors').h3.turbo.loraRef, 't.safetensors');
  assert.equal(V.videoSlotPatch(h, 'H1', 'x.safetensors').h3.loras[0].name, 'x.safetensors');
  assert.equal(V.videoSlotPatch(v, 'nope', 'x'), null);
});

test('On/Off, strength and remove patches', () => {
  const v = video();
  assert.deepEqual(V.videoSetOnPatch(v, 'wan:fast:high', false), { fast: false });
  assert.equal(V.videoSetOnPatch(v, 'L2', true).loras[1].on, true);
  assert.equal(V.videoSetOnPatch(v, 'h3:turbo', true).h3.turbo.on, true);
  assert.equal(V.videoSetOnPatch(v, 'wan:high', false), null, 'a slot has no switch');
  assert.equal(V.videoSetWeightPatch(v, 'L1', 1.2).loras[0].strength, 1.2);
  assert.equal(V.videoSetWeightPatch(v, 'h3:turbo', 0.5).h3.turbo.strength, 0.5);
  assert.equal(V.videoSetWeightPatch(v, 'H1', 0.7).h3.loras[0].strength, 0.7);
  assert.deepEqual(V.videoRemovePatch(v, 'L1').loras.map((l) => l.id), ['L2']);
  assert.deepEqual(V.videoRemovePatch(v, 'H1').h3.loras, []);
  assert.equal(V.videoRemovePatch(v, 'wan:fast:high'), null, 'the speed LoRAs are fixed');
  assert.equal(V.videoRemovePatch(v, 'wan:high'), null);
});

test('a landed download renames every slot that waited for the file, across tasks and engines', () => {
  const v = video({ models: { t2v: { high: 'pending_high.safetensors', low: 't2v_low.safetensors' }, i2v: { high: 'pending_high.safetensors', low: 'i2v_low.safetensors' } } });
  assert.deepEqual(V.videoSlotsHolding(v, 'checkpoint', 'Pending_High.safetensors'), ['wan:t2v:high', 'wan:i2v:high']);
  assert.equal(V.videoHasFile(v, 'checkpoint', 'pending_high.safetensors'), true);
  assert.equal(V.videoHasFile(v, 'checkpoint', 'nope.safetensors'), false);
  const p = V.videoLandPatch(v, 'checkpoint', 'pending_high.safetensors', 'Wan/pending_high.safetensors', true);
  assert.equal(p.models.t2v.high, 'Wan/pending_high.safetensors');
  assert.equal(p.models.i2v.high, 'Wan/pending_high.safetensors');
  assert.equal(p.models.t2v.low, 't2v_low.safetensors');
  // A LoRA comes back On as the user chose while it waited.
  const w = video({ loras: [{ id: 'L9', name: 'new_lora.safetensors', strength: 1, on: false, expert: 'both' }] });
  const lp = V.videoLandPatch(w, 'lora', 'new_lora.safetensors', 'sub/new_lora.safetensors', true);
  assert.deepEqual(lp.loras[0], { id: 'L9', name: 'sub/new_lora.safetensors', strength: 1, on: true, expert: 'both' });
  // The H3 side and the speed LoRAs land too; nothing waiting → null.
  const h = video({ h3: { ...video().h3, loras: [{ id: 'H2', name: 'new_lora.safetensors', strength: 1, on: false }] } });
  assert.equal(V.videoLandPatch(h, 'lora', 'new_lora.safetensors', 'new_lora.safetensors', false).h3.loras[0].on, false);
  assert.equal(V.videoLandPatch(video(), 'lora', 'lx_i2v_low.safetensors', 'speed/lx_i2v_low.safetensors', true).fastLoras.i2v.low, 'speed/lx_i2v_low.safetensors');
  assert.equal(V.videoLandPatch(video(), 'vae', 'h3_audio_vae.safetensors', 'h3/audio.safetensors', true).h3.audioVae, 'h3/audio.safetensors');
  assert.equal(V.videoLandPatch(video(), 'clip', 'umt5.safetensors', 'te/umt5.safetensors', true).textEncoder, 'te/umt5.safetensors');
  assert.equal(V.videoLandPatch(video(), 'lora', 'nothing.safetensors', 'x', true), null);
});

// ── the Workflow step's loaders ───────────────────────────────────────────

const Q = (over) => ({ id: '1:x', nodeId: 1, nodeLabel: 'Node', nodeType: 'KSampler', name: 'x', type: 'INT', value: 0, default: 0, multiline: false, seedLike: false, ...over });
const ckpt = Q({ id: '4:ckpt_name', nodeId: 4, nodeLabel: 'Load Checkpoint', nodeType: 'CheckpointLoaderSimple', name: 'ckpt_name', type: 'COMBO', value: 'wai.safetensors', options: ['wai.safetensors', 'SDXL/pony.safetensors'] });
const loraName = Q({ id: '7:lora_name', nodeId: 7, nodeLabel: 'Detail LoRA', nodeType: 'LoraLoader', name: 'lora_name', type: 'COMBO', value: 'detail.safetensors', options: ['detail.safetensors'] });
const loraStr = Q({ id: '7:strength_model', nodeId: 7, nodeLabel: 'Detail LoRA', nodeType: 'LoraLoader', name: 'strength_model', type: 'FLOAT', value: 0.8 });
const loraClip = Q({ id: '7:strength_clip', nodeId: 7, nodeLabel: 'Detail LoRA', nodeType: 'LoraLoader', name: 'strength_clip', type: 'FLOAT', value: 0.5 });
const clip1 = Q({ id: '9:clip_name1', nodeId: 9, nodeLabel: 'DualCLIPLoader', nodeType: 'DualCLIPLoader', name: 'clip_name1', type: 'COMBO', value: 't5.safetensors', options: ['t5.safetensors', 'clip_l.safetensors'] });
const ipa = Q({ id: '11:ipadapter_file', nodeId: 11, nodeLabel: 'IP-Adapter', nodeType: 'IPAdapterModelLoader', name: 'ipadapter_file', type: 'COMBO', value: 'ip.safetensors', options: ['ip.safetensors'] });
const sampler = Q({ id: '3:sampler_name', nodeId: 3, name: 'sampler_name', type: 'COMBO', value: 'euler', options: ['euler', 'dpmpp_2m'] });
const steps = Q({ id: '3:steps', nodeId: 3, name: 'steps', type: 'INT', value: 20 });
const params = [ckpt, loraName, loraStr, loraClip, clip1, ipa, sampler, steps];

test('loaderKind: the modal kinds, text encoders → clip, the rest → other', () => {
  assert.equal(W.loaderKind(ckpt), 'checkpoint');
  assert.equal(W.loaderKind(loraName), 'lora');
  assert.equal(W.loaderKind(clip1), 'clip');
  assert.equal(W.loaderKind({ name: 'text_encoder_name', nodeType: 'X' }), 'clip');
  assert.equal(W.loaderKind(ipa), 'other');
  assert.equal(W.loaderKind({ name: 'vae_name', nodeType: 'VAELoader' }), 'vae');
  assert.equal(W.loaderKind({ name: 'model_name', nodeType: 'UpscaleModelLoader' }), 'upscale');
});

test('workflowKinds: only kinds with a loader, in list order', () => {
  assert.deepEqual(W.workflowKinds(params), ['checkpoint', 'lora', 'clip', 'other']);
  assert.deepEqual(W.workflowKinds([sampler, steps]), []);
});

test('strengthWidgets: the node\'s strength_model / strength and strength_clip', () => {
  const s = W.strengthWidgets(params, loraName);
  assert.equal(s.main.id, '7:strength_model');
  assert.equal(s.clip.id, '7:strength_clip');
  assert.deepEqual(W.strengthWidgets(params, ckpt), { main: undefined, clip: undefined });
  const plain = [Q({ id: '8:lora_name', nodeId: 8, nodeType: 'LoraLoaderModelOnly', name: 'lora_name', type: 'COMBO', options: ['a.safetensors'] }), Q({ id: '8:strength', nodeId: 8, name: 'strength', type: 'FLOAT', value: 1 })];
  assert.equal(W.strengthWidgets(plain, plain[0]).main.id, '8:strength');
});

test('workflowEntries: one fixed entry per loader, the node title as badge, strength only when the node has one', () => {
  const ck = W.workflowEntries(params, {}, 'checkpoint');
  assert.deepEqual(ck, [{ id: '4:ckpt_name', name: 'wai.safetensors', on: true, weight: 1, badge: 'Load Checkpoint', fixed: true, noWeight: true }]);
  const lo = W.workflowEntries(params, { '7:strength_model': 1.3 }, 'lora');
  assert.equal(lo[0].weight, 1.3, 'the edited value wins over the saved one');
  assert.equal(lo[0].noWeight, false);
  assert.equal(W.workflowEntries(params, {}, 'lora')[0].weight, 0.8);
  assert.equal(W.workflowEntries(params, { '4:ckpt_name': 'SDXL/pony.safetensors' }, 'checkpoint')[0].name, 'SDXL/pony.safetensors');
  assert.deepEqual(W.workflowEntries(params, {}, 'other').map((e) => e.badge), ['IP-Adapter']);
  assert.deepEqual(W.workflowEntries(params, {}, 'vae'), []);
});

test('matchOption and loadersHolding read files by base name', () => {
  assert.equal(W.matchOption(['SDXL/pony.safetensors'], 'pony.safetensors'), 'SDXL/pony.safetensors');
  assert.equal(W.matchOption(['SDXL/pony.safetensors'], 'SDXL/pony.safetensors'), 'SDXL/pony.safetensors');
  assert.equal(W.matchOption(['a.safetensors'], 'b.safetensors'), null);
  assert.deepEqual(W.loadersHolding(params, {}, 'checkpoint', 'WAI.safetensors'), ['4:ckpt_name']);
  assert.deepEqual(W.loadersHolding(params, { '4:ckpt_name': 'pending.safetensors' }, 'checkpoint', 'pending.safetensors'), ['4:ckpt_name']);
  assert.deepEqual(W.loadersHolding(params, {}, 'lora', 'wai.safetensors'), []);
});
