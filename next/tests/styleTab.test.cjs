// Style tab: per-server readiness, the type tiles (what a click can add, and why not), list edits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const R = load('../src/lib/styleRefs.ts');
const L = load('src/screens/image/style/styleTabLogic.ts', { '@/lib/styleRefs': R });
const E = load('src/screens/image/style/styleRefsEdit.ts', { '@/lib/styleRefs': R });

const ALL_NODES = [...new Set(Object.values(R.FEATURE_NODES).flat())];
const full = {
  style: { nodes: ALL_NODES, ipadapter: ['ip-adapter-plus_sdxl_vit-h.safetensors', 'ip-adapter-faceid-plusv2_sdxl.bin', 'ip-adapter-faceid-portrait_sdxl.bin', 'ip-adapter-plus_sd15.safetensors', 'ip_plus_composition_sd15.safetensors', 'ip-adapter-faceid-plusv2_sd15.bin'],
    clipVision: ['CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors', 'sigclip_vision_patch14_384.safetensors'], styleModels: ['flux1-redux-dev.safetensors'], instantid: ['ip-adapter.bin'], pulid: ['ip-adapter_pulid_sdxl_fp16.safetensors'], weightTypes: [] },
  loras: ['ip-adapter-faceid-plusv2_sdxl_lora.safetensors', 'ip-adapter-faceid-plusv2_sd15_lora.safetensors'],
  controlnets: ['instantid\\diffusion_pytorch_model.safetensors'],
};
const bare = { style: { nodes: ['CLIPVisionLoader', 'StyleModelLoader', 'StyleModelApply', 'CLIPVisionEncode'], ipadapter: [], clipVision: [], styleModels: [], instantid: [], pulid: [], weightTypes: [] }, loras: [], controlnets: [] };
const servers = [{ id: 'w', name: 'winold' }, { id: 'p', name: 'Pod' }, { id: 'off', name: 'Old box' }, { id: 'x', name: 'Paused', enabled: false }];

test('types per family: SD / SDXL get IP-Adapter + Face, Flux gets Redux, others nothing', () => {
  assert.deepEqual(L.fittingTypes('sdxl'), ['style', 'composition', 'subject', 'face']);
  assert.deepEqual(L.fittingTypes('sd15'), ['style', 'composition', 'subject', 'face']);
  assert.deepEqual(L.fittingTypes('flux'), ['redux']);
  assert.deepEqual(L.fittingTypes(null), []);
  assert.deepEqual(R.faceMethodsFor('sd15'), ['faceid', 'portrait']);
  assert.deepEqual(R.faceMethodsFor('sdxl'), ['faceid', 'portrait', 'instantid', 'pulid']);
});

test('server rows: what runs where and what is missing; paused servers left out, offline ones marked', () => {
  const rows = L.serverRows(servers, { w: full, p: bare }, 'sdxl');
  assert.deepEqual(rows.map((r) => r.id), ['w', 'p', 'off']);
  assert.deepEqual(rows[0].ready, ['style', 'composition', 'subject', 'face']);
  assert.deepEqual(rows[0].lacks, []);
  assert.deepEqual(rows[1].ready, []);
  assert.deepEqual(rows[1].lacks, ['IP-Adapter nodes (ComfyUI_IPAdapter_plus)']);
  assert.equal(rows[2].online, false);
  assert.equal(L.readiness(rows, 'sdxl'), 'partial');
  assert.equal(L.readiness([rows[0]], 'sdxl'), 'ready');
  assert.equal(L.readiness([rows[1]], 'sdxl'), 'none');
  assert.equal(L.readiness([rows[2]], 'sdxl'), 'offline');
});

test('tiles: a click can only add what some online server runs; otherwise one short reason', () => {
  const t1 = L.tileStates(L.serverRows(servers, { w: full, p: bare }, 'sdxl'), 'sdxl');
  assert.ok(t1.every((t) => t.ok));
  assert.equal(t1[0].note, 'Not on Pod');
  const t2 = L.tileStates(L.serverRows([{ id: 'p', name: 'Pod' }], { p: bare }, 'sdxl'), 'sdxl');
  assert.ok(t2.every((t) => !t.ok));
  assert.equal(t2[0].note, 'Needs IP-Adapter nodes on Pod');
  const t3 = L.tileStates(L.serverRows([{ id: 'w', name: 'winold' }], {}, 'sdxl'), 'sdxl');
  assert.equal(t3[0].note, 'No server online');
  const flux = L.tileStates(L.serverRows([{ id: 'w', name: 'winold' }], { w: full }, 'flux'), 'flux');
  assert.deepEqual(flux.map((t) => [t.type, t.ok]), [['redux', true]]);
  const noRedux = L.tileStates(L.serverRows([{ id: 'p', name: 'Pod' }], { p: bare }, 'flux'), 'flux');
  assert.equal(noRedux[0].note, 'Needs Redux model on Pod');
});

test('add: defaults from the packs; InstantID lowers a high CFG (and only then)', () => {
  const a = E.addRef([], 'a', 'style', 'sdxl', 7);
  assert.equal(a.refs.length, 1);
  assert.equal(a.cfg, undefined);
  assert.equal(a.refs[0].weightType, 'style transfer');
  const f = E.addRef(a.refs, 'b', 'face', 'sdxl', 7, 'instantid');
  assert.equal(f.refs[1].method, 'instantid');
  assert.equal(f.refs[1].noise, 0.35);
  assert.equal(f.cfg, 4.5);
  assert.equal(E.addRef([], 'c', 'face', 'sdxl', 4, 'instantid').cfg, undefined);
  assert.equal(E.addRef([], 'd', 'face', 'sdxl', 7).refs[0].method, 'faceid');
  const list = E.replaceRef(f.refs, 'a', { weight: 0.5 });
  assert.equal(list[0].weight, 0.5);
  assert.notEqual(list, f.refs);
  assert.deepEqual(E.removeRef(list, 'a').map((r) => r.id), ['b']);
});
