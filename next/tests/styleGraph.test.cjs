// Style tab (style-tab-plan.md §4): the graph stage in src/lib/graphs (style.ts via core.ts).
// 1. Old saved workflows (no style refs) build the very same graph, byte for byte, as before the
//    stage existed: fixtures/style-baseline.json was captured from the builder before the change.
// 2. The stage's shape per type, with the files winold lists (live /object_info, 10-20).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..', '..');
const out = esbuild.buildSync({
  stdin: { contents: "export { buildGraph } from '@/lib/graphs'; export * from '@/lib/styleRefs';", resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
  alias: { '@': path.join(root, 'src') },
  define: { 'import.meta.env': '{"DEV":false}' },
  banner: { js: 'if(!globalThis.localStorage){const m=new Map();globalThis.localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}' },
});
const mod = { exports: {} };
new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, require);
const G = mod.exports;
const cases = require('./fixtures/style-baseline.json');

test('old workflows build the very same graph (byte for byte)', () => {
  for (const c of cases) {
    const g = G.buildGraph(c.workflow, c.layers, c.inputRef, c.inpaint).graph;
    assert.equal(JSON.stringify(g), JSON.stringify(c.graph), c.name);
  }
});

test('empty, switched-off, picture-less or not-uploaded references change nothing', () => {
  const img = { key: 'k1', name: 'a.png', width: 512, height: 512, thumb: 'data:x' };
  const use = { model: 'ip-adapter-plus_sdxl_vit-h.safetensors', clipVision: 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors' };
  for (const c of cases) {
    const variants = [
      [{ ...c.workflow, styleRefs: [] }, { styleImages: { k1: 'x.png' } }],
      [{ ...c.workflow, styleRefs: [{ id: 'a', type: 'style', on: false, images: [img], weight: 1, start: 0, end: 1, use }] }, { styleImages: { k1: 'x.png' } }],
      [{ ...c.workflow, styleRefs: [{ id: 'a', type: 'style', on: true, images: [], weight: 1, start: 0, end: 1, use }] }, { styleImages: {} }],
      [{ ...c.workflow, styleRefs: [{ id: 'a', type: 'style', on: true, images: [img], weight: 1, start: 0, end: 1, use }] }, {}],
      [{ ...c.workflow, styleRefs: [{ id: 'a', type: 'style', on: true, images: [img], weight: 1, start: 0, end: 1 }] }, { styleImages: { k1: 'x.png' } }],
    ];
    for (const [wf, extras] of variants) {
      assert.equal(JSON.stringify(G.buildGraph(wf, c.layers, c.inputRef, c.inpaint, extras).graph), JSON.stringify(c.graph), c.name);
    }
  }
});

// winold's lists (live /object_info 10-20).
const support = {
  nodes: ['IPAdapterModelLoader', 'IPAdapterAdvanced', 'CLIPVisionLoader', 'IPAdapterInsightFaceLoader', 'IPAdapterFaceID', 'LoraLoaderModelOnly',
    'InstantIDModelLoader', 'InstantIDFaceAnalysis', 'ApplyInstantID', 'ControlNetLoader', 'PulidModelLoader', 'PulidInsightFaceLoader',
    'PulidEvaClipLoader', 'ApplyPulid', 'StyleModelLoader', 'StyleModelApply', 'CLIPVisionEncode'],
  ipadapter: ['ip-adapter-faceid-plusv2_sd15.bin', 'ip-adapter-faceid-plusv2_sdxl.bin', 'ip-adapter-faceid-portrait-v11_sd15.bin', 'ip-adapter-faceid-portrait_sdxl.bin',
    'ip-adapter-faceid-portrait_sdxl_unnorm.bin', 'ip-adapter-faceid_sd15.bin', 'ip-adapter-faceid_sdxl.bin', 'ip-adapter-full-face_sd15.safetensors',
    'ip-adapter-plus-face_sd15.safetensors', 'ip-adapter-plus-face_sdxl_vit-h.safetensors', 'ip-adapter-plus_sd15.safetensors', 'ip-adapter-plus_sdxl_vit-h.safetensors',
    'ip-adapter_sd15.safetensors', 'ip-adapter_sd15_light_v11.bin', 'ip-adapter_sd15_vit-G.safetensors', 'ip-adapter_sdxl.safetensors', 'ip-adapter_sdxl_vit-h.safetensors',
    'ip_plus_composition_sd15.safetensors', 'ip_plus_composition_sdxl.safetensors'],
  clipVision: ['CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors', 'CLIP-ViT-bigG-14-laion2B-39B-b160k.safetensors', 'clip-vision_vit-h.safetensors', 'model.safetensors', 'sigclip_vision_patch14_384.safetensors'],
  styleModels: ['flux1-redux-dev.safetensors'],
  instantid: ['ip-adapter.bin'],
  pulid: ['ip-adapter_pulid_sdxl_fp16.safetensors'],
  weightTypes: [],
};
const extra = {
  loras: ['ip-adapter-faceid-plusv2_sd15_lora.safetensors', 'ip-adapter-faceid-plusv2_sdxl_lora.safetensors', 'ip-adapter-faceid_sd15_lora.safetensors', 'ip-adapter-faceid_sdxl_lora.safetensors'],
  controlnets: ['SDXL\\OpenPoseXL2.safetensors', 'instantid\\diffusion_pytorch_model.safetensors'],
};

test('model picks per family and type', () => {
  const pick = (r, fam) => G.pickModel(r, fam, support);
  assert.equal(pick({ type: 'style' }, 'sdxl'), 'ip-adapter-plus_sdxl_vit-h.safetensors');
  assert.equal(pick({ type: 'subject' }, 'sd15'), 'ip-adapter-plus_sd15.safetensors');
  assert.equal(pick({ type: 'composition' }, 'sdxl'), 'ip_plus_composition_sdxl.safetensors');
  assert.equal(pick({ type: 'composition' }, 'sd15'), 'ip_plus_composition_sd15.safetensors');
  assert.equal(pick({ type: 'face' }, 'sdxl'), 'ip-adapter-faceid-plusv2_sdxl.bin');
  assert.equal(pick({ type: 'face', method: 'portrait' }, 'sdxl'), 'ip-adapter-faceid-portrait_sdxl.bin');
  assert.equal(pick({ type: 'face', method: 'portrait' }, 'sd15'), 'ip-adapter-faceid-portrait-v11_sd15.bin');
  assert.equal(pick({ type: 'face', method: 'instantid' }, 'sdxl'), 'ip-adapter.bin');
  assert.equal(pick({ type: 'face', method: 'pulid' }, 'sdxl'), 'ip-adapter_pulid_sdxl_fp16.safetensors');
  assert.equal(pick({ type: 'redux' }, 'flux'), 'flux1-redux-dev.safetensors');
  assert.equal(pick({ type: 'style', model: 'ip-adapter_sdxl.safetensors' }, 'sdxl'), 'ip-adapter_sdxl.safetensors');
  assert.equal(pick({ type: 'style', model: 'gone.safetensors' }, 'sdxl'), 'ip-adapter-plus_sdxl_vit-h.safetensors');
  assert.equal(G.pickClipVision('ip-adapter-plus_sdxl_vit-h.safetensors', support), 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors');
  assert.equal(G.pickClipVision('ip-adapter_sdxl.safetensors', support), 'CLIP-ViT-bigG-14-laion2B-39B-b160k.safetensors');
  assert.equal(G.pickClipVision('flux1-redux-dev.safetensors', support, 'redux'), 'sigclip_vision_patch14_384.safetensors');
  assert.equal(G.pickLora('ip-adapter-faceid-plusv2_sdxl.bin', extra.loras), 'ip-adapter-faceid-plusv2_sdxl_lora.safetensors');
  assert.equal(G.pickLora('ip-adapter-faceid-portrait_sdxl.bin', extra.loras), '');
  assert.equal(G.pickControlnet(extra.controlnets), 'instantid\\diffusion_pytorch_model.safetensors');
});

test('what is missing: no nodes → the pack to install; no files → which folder', () => {
  const none = { ...support, nodes: [], ipadapter: [] };
  assert.deepEqual(G.refMissing({ type: 'style' }, 'sdxl', none), ['IP-Adapter nodes (ComfyUI_IPAdapter_plus)']);
  assert.deepEqual(G.refMissing({ type: 'face', method: 'instantid' }, 'sdxl', none), ['InstantID nodes (ComfyUI_InstantID)']);
  assert.deepEqual(G.refMissing({ type: 'style' }, 'sdxl', { ...support, ipadapter: [] }), ['SDXL adapter (models/ipadapter)']);
  assert.deepEqual(G.refMissing({ type: 'style' }, 'sdxl', support, extra), []);
  assert.deepEqual(G.refMissing({ type: 'face' }, 'sdxl', support, { loras: [] }), ['FaceID LoRA (models/loras)']);
  assert.deepEqual(G.refMissing({ type: 'redux' }, 'flux', { ...support, styleModels: [] }), ['Redux model (style_models)']);
  assert.ok(G.refMissing({ type: 'style' }, 'sdxl', undefined)[0].includes('not read'));
  assert.equal(G.typeFits('redux', 'sdxl'), false);
  assert.equal(G.typeFits('style', 'flux'), false);
  assert.equal(G.typeFits('style', null), false);
});

test('styleSupportOf reads nodes and combos from /object_info (both combo shapes)', () => {
  const s = G.styleSupportOf({
    IPAdapterModelLoader: { input: { required: { ipadapter_file: [['a_sdxl.bin']] } } },
    CLIPVisionLoader: { input: { required: { clip_name: ['COMBO', { options: ['h.safetensors'] }] } } },
    IPAdapterAdvanced: { input: { required: { weight_type: [['linear', 'style transfer']] } } },
  });
  assert.deepEqual(s.nodes, ['IPAdapterModelLoader', 'IPAdapterAdvanced', 'CLIPVisionLoader']);
  assert.deepEqual(s.ipadapter, ['a_sdxl.bin']);
  assert.deepEqual(s.clipVision, ['h.safetensors']);
  assert.deepEqual(s.weightTypes, ['linear', 'style transfer']);
  assert.deepEqual(G.styleSupportOf(null).nodes, []);
});

const img = (k) => ({ key: k, name: `${k}.png`, width: 768, height: 768, thumb: 'data:x' });
const withRefs = (c, refs, fam) => ({ ...c.workflow, styleRefs: G.resolveStyleRefs(refs, fam, support, extra) });
const sdxl = cases.find((c) => c.name === 'sdxl loras + clip skip');

test('IP-Adapter: after the LoRAs, before the sampler; several pictures batch; loaders shared', () => {
  const refs = [
    { ...G.newStyleRef('a', 'style', 'sdxl'), images: [img('k1'), img('k2')] },
    { ...G.newStyleRef('b', 'subject', 'sdxl'), images: [img('k3')] },
  ];
  const g = G.buildGraph(withRefs(sdxl, refs, 'sdxl'), sdxl.layers, null, null, { styleImages: { k1: 'imagelab/1.png', k2: 'imagelab/2.png', k3: 'imagelab/3.png' } }).graph;
  assert.equal(g.sr0a.class_type, 'IPAdapterAdvanced');
  assert.deepEqual(g.sr0a.inputs.model, ['l2', 0]); // the last LoRA
  assert.equal(g.sr0a.inputs.weight_type, 'style transfer');
  assert.deepEqual(g.sr0a.inputs.image, ['sr0b1', 0]);
  assert.equal(g.sr0b1.class_type, 'ImageBatch');
  assert.deepEqual(g.sr1a.inputs.model, ['sr0a', 0]);
  assert.deepEqual(g.sr1a.inputs.ipadapter, ['sr0m', 0]); // same file: one loader
  assert.equal(g.sr1m, undefined);
  assert.deepEqual(g['3'].inputs.model, ['sr1a', 0]);
  assert.deepEqual(g['3'].inputs.positive, ['6', 0]);
  assert.equal(g.sr0c.inputs.clip_name, 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors');
  assert.equal(g.sr0i0.inputs.image, 'imagelab/1.png');
});

test('FaceID v2: its LoRA (model only) then IPAdapterFaceID with insightface', () => {
  const refs = [{ ...G.newStyleRef('f', 'face', 'sdxl'), images: [img('k1')] }];
  const g = G.buildGraph(withRefs(sdxl, refs, 'sdxl'), sdxl.layers, null, null, { styleImages: { k1: 'f.png' } }).graph;
  assert.equal(g.sr0l.class_type, 'LoraLoaderModelOnly');
  assert.equal(g.sr0l.inputs.lora_name, 'ip-adapter-faceid-plusv2_sdxl_lora.safetensors');
  assert.equal(g.sr0a.class_type, 'IPAdapterFaceID');
  assert.deepEqual(g.sr0a.inputs.model, ['sr0l', 0]);
  assert.deepEqual(g.sr0a.inputs.insightface, ['sr0f', 0]);
  assert.equal(g.sr0f.inputs.provider, 'CUDA');
  assert.deepEqual(g['3'].inputs.model, ['sr0a', 0]);
});

test('InstantID: model + both prompts, every prompt reference rewired (passes too)', () => {
  const lb = cases.find((c) => c.name === 'sdxl loopback');
  const refs = [{ ...G.newStyleRef('f', 'face', 'sdxl'), method: 'instantid', images: [img('k1')] }];
  const g = G.buildGraph(withRefs(lb, refs, 'sdxl'), lb.layers, null, null, { styleImages: { k1: 'f.png' } }).graph;
  assert.equal(g.sr0a.class_type, 'ApplyInstantIDAdvanced');
  assert.deepEqual(g.sr0a.inputs.positive, ['6', 0]);
  assert.deepEqual(g.sr0a.inputs.negative, ['7', 0]);
  assert.equal(g.sr0n.inputs.control_net_name, 'instantid\\diffusion_pytorch_model.safetensors');
  assert.deepEqual(g['3'].inputs.model, ['sr0a', 0]);
  assert.deepEqual(g['3'].inputs.positive, ['sr0a', 1]);
  assert.deepEqual(g['3'].inputs.negative, ['sr0a', 2]);
  for (const [id, n] of Object.entries(g)) {
    if (id.startsWith('sr')) continue;
    for (const v of Object.values(n.inputs)) {
      assert.ok(!(Array.isArray(v) && (v[0] === '6' || v[0] === '7') && v[1] === 0), `${id} still reads the bare prompt`);
    }
  }
});

test('Flux Redux: StyleModelApply after FluxGuidance, one per picture', () => {
  const flux = cases.find((c) => c.name === 'flux lora');
  const refs = [{ ...G.newStyleRef('r', 'redux', 'flux'), images: [img('k1'), img('k2')] }];
  const g = G.buildGraph(withRefs(flux, refs, 'flux'), flux.layers, null, null, { styleImages: { k1: 'a.png', k2: 'b.png' } }).graph;
  assert.equal(g['6'].class_type, 'FluxGuidance');
  assert.deepEqual(g.sr0a0.inputs.conditioning, ['6', 0]);
  assert.deepEqual(g.sr0a1.inputs.conditioning, ['sr0a0', 0]);
  assert.deepEqual(g['3'].inputs.positive, ['sr0a1', 0]);
  assert.equal(g.sr0c.inputs.clip_name, 'sigclip_vision_patch14_384.safetensors');
  assert.deepEqual(g['3'].inputs.model, ['l0', 0]); // Redux leaves the model alone
});

test('PuLID: ApplyPulid on the model', () => {
  const refs = [{ ...G.newStyleRef('p', 'face', 'sdxl'), method: 'pulid', images: [img('k1')] }];
  const g = G.buildGraph(withRefs(sdxl, refs, 'sdxl'), sdxl.layers, null, null, { styleImages: { k1: 'f.png' } }).graph;
  assert.equal(g.sr0a.class_type, 'ApplyPulid');
  assert.equal(g.sr0a.inputs.method, 'fidelity');
  assert.deepEqual(g.sr0a.inputs.eva_clip, ['sr0e', 0]);
  assert.deepEqual(g['3'].inputs.model, ['sr0a', 0]);
});

test('a reference that does not fit the family never reaches the graph', () => {
  const refs = [{ ...G.newStyleRef('a', 'style', 'sdxl'), images: [img('k1')] }];
  const flux = cases.find((c) => c.name === 'flux lora');
  const wf = withRefs(flux, refs, 'flux');
  assert.equal(wf.styleRefs[0].use, undefined);
  assert.equal(JSON.stringify(G.buildGraph(wf, flux.layers, null, null, { styleImages: { k1: 'a.png' } }).graph), JSON.stringify(flux.graph));
});
