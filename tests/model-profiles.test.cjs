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
const {
  MODEL_PROFILES, resolveProfile, workflowFamily, profileTransition, profileTagLayers, withProfileTags,
  withProfileTag, bucketFits, vaeFits, guessProfileFromName,
} = load('modelProfiles');
const plain = (v) => JSON.parse(JSON.stringify(v));
const wf = (extra = {}) => ({ width: 1024, height: 1024, steps: 12, cfg: 8.6, ...extra });

test('every SD type runs an SD graph; unknown types keep the SDXL graph', () => {
  assert.equal(workflowFamily({ modelProfile: 'SD 1.5' }), 'sd15');
  for (const id of ['SDXL', 'Pony', 'Illustrious', 'NoobAI']) assert.equal(workflowFamily({ modelProfile: id }), 'sdxl');
  assert.equal(workflowFamily({}), 'sdxl');
  assert.equal(workflowFamily({ modelProfile: 'Flux' }), 'sdxl');
});

test('resolveProfile: override, then CivitAI bucket, then a name guess once the lookup is done', () => {
  assert.equal(resolveProfile('a.safetensors', 'Pony', false), 'Pony');
  assert.equal(resolveProfile('a.safetensors', 'Pony', false, 'Illustrious'), 'Illustrious');
  assert.equal(resolveProfile('ponyDiffusion.safetensors', 'Unknown', true), undefined);
  assert.equal(resolveProfile('ponyDiffusion.safetensors', 'Unknown', false), 'Pony');
  assert.equal(resolveProfile('mystery.safetensors', 'Unknown', false), null);
  assert.equal(resolveProfile('flux1-dev.safetensors', 'Flux', false), null);
  assert.equal(resolveProfile(undefined, 'Unknown', false), null);
  assert.equal(guessProfileFromName('noobaiXL_v11.safetensors'), 'NoobAI');
  assert.equal(guessProfileFromName('juggernautXL_v9.safetensors'), 'SDXL');
  assert.equal(guessProfileFromName('realisticVision_sd15.safetensors'), 'SD 1.5');
});

test('within the SDXL types only values still at the old default move', () => {
  const full = (extra = {}) => wf({ sampler: 'euler_ancestral', scheduler: 'normal', vae: 'sdxl_vae.safetensors', ...extra });
  // Pony → Illustrious: nothing to change (same defaults), hand-set values stay.
  assert.deepEqual(plain(profileTransition(full({ width: 832, cfg: 5 }), 'Pony', 'Illustrious')), { modelProfile: 'Illustrious' });
  // To a type with no profile: only the type is cleared.
  assert.deepEqual(plain(profileTransition(full(), 'Pony', null)), { modelProfile: '' });
});

test('SD 1.5 is its own side: SDXL values are kept for the way back, never carried over', () => {
  const pony = wf({ width: 832, height: 1216, sampler: 'euler_ancestral', scheduler: 'normal', vae: 'sdxl_vae.safetensors', modelProfile: 'Pony' });
  const to15 = plain(profileTransition(pony, 'Pony', 'SD 1.5'));
  assert.deepEqual({ ...to15, typeSettings: undefined }, {
    modelProfile: 'SD 1.5', width: 512, height: 512, steps: 25, cfg: 7, sampler: 'dpmpp_2m', scheduler: 'karras', vae: '', typeSettings: undefined,
  });
  assert.equal(to15.typeSettings.sd.vae, 'sdxl_vae.safetensors');
  // Hand-set on SD 1.5, then to Illustrious and back: each side as it was left.
  const sd15 = { ...pony, ...to15, width: 512, height: 768, cfg: 6 };
  const toIl = plain(profileTransition(sd15, 'SD 1.5', 'Illustrious'));
  assert.equal(toIl.width, 832); assert.equal(toIl.height, 1216); assert.equal(toIl.vae, 'sdxl_vae.safetensors'); assert.equal(toIl.cfg, 8.6);
  const back = plain(profileTransition({ ...sd15, ...toIl }, 'Illustrious', 'SD 1.5'));
  assert.equal(back.height, 768); assert.equal(back.cfg, 6); assert.equal(back.vae, '');
});

test('first check of an old workflow is not a switch (except to Anima)', () => {
  const old = wf({ width: 512, height: 768, steps: 30, cfg: 7.5, sampler: 'euler', scheduler: 'karras', vae: 'vae-ft-mse.safetensors' });
  assert.deepEqual(plain(profileTransition(old, undefined, 'SD 1.5')), { modelProfile: 'SD 1.5' });
  const anima = plain(profileTransition(old, undefined, 'Anima'));
  assert.equal(anima.cfg, 4); assert.equal(anima.vae, 'qwen_image_vae.safetensors'); assert.equal(anima.typeSettings.sd.cfg, 7.5);
});

test('Pony: every score tag on, source and rating tags off, BREAK after them', () => {
  const w = { modelProfile: 'Pony' };
  const tags = profileTagLayers(w);
  const on = (kind) => plain(tags.filter((l) => l.on && l.kind === kind).map((l) => l.text));
  assert.deepEqual(on('positive'), ['score_9', 'score_8_up', 'score_7_up', 'score_6_up', 'score_5_up', 'score_4_up', 'BREAK']);
  assert.deepEqual(on('negative'), ['score_6', 'score_5', 'score_4']);
  const off = plain(tags.filter((l) => !l.on).map((l) => l.text));
  assert.deepEqual(off, ['source_anime', 'source_pony', 'source_furry', 'source_cartoon', 'rating_safe', 'rating_questionable', 'rating_explicit']);
  // BREAK is not a pill.
  assert.equal(MODEL_PROFILES.Pony.tags.some((t) => t.text === 'BREAK'), false);
  // A turned-on source tag goes before BREAK.
  const src = MODEL_PROFILES.Pony.tags.find((t) => t.text === 'source_anime');
  const withSrc = { ...w, ...withProfileTag(w, MODEL_PROFILES.Pony, src, true) };
  const pos = plain(profileTagLayers(withSrc).filter((l) => l.on && l.kind === 'positive').map((l) => l.text));
  assert.deepEqual(pos.slice(-2), ['source_anime', 'BREAK']);
  // Every positive tag off: no BREAK either.
  let none = w;
  for (const t of MODEL_PROFILES.Pony.tags.filter((t) => t.kind === 'positive')) none = { ...none, ...withProfileTag(none, MODEL_PROFILES.Pony, t, false) };
  assert.equal(profileTagLayers(none).some((l) => l.on && l.kind === 'positive'), false);
  // Tags lead the user's prompt.
  const mine = [{ id: 'x', kind: 'positive', on: true, weight: 1, tag: 'S', text: 'a cat' }];
  assert.equal(withProfileTags(mine, w)[0].text, 'score_9');
  assert.equal(withProfileTags(mine, {}), mine);
  assert.deepEqual(plain(profileTagLayers({ modelProfile: 'SDXL' })), []);
});

test('BREAK splits the text encoder into joined chunks; no BREAK leaves it alone', () => {
  const { applyBreaks, breakParts } = load('pipeline');
  assert.deepEqual(plain(breakParts('score_9, score_8_up, BREAK, a cat, BREAK, soft light')), ['score_9, score_8_up', 'a cat', 'soft light']);
  assert.deepEqual(plain(breakParts('BREAKING news')), ['BREAKING news']);
  const g = { 6: { class_type: 'CLIPTextEncode', inputs: { text: 'score_9, BREAK, a cat, BREAK, soft light', clip: ['l0', 1] } } };
  applyBreaks(g, '6');
  assert.deepEqual(plain(g), {
    '6b0': { class_type: 'CLIPTextEncode', inputs: { text: 'score_9', clip: ['l0', 1] } },
    '6b1': { class_type: 'CLIPTextEncode', inputs: { text: 'a cat', clip: ['l0', 1] } },
    '6b2': { class_type: 'CLIPTextEncode', inputs: { text: 'soft light', clip: ['l0', 1] } },
    '6j1': { class_type: 'ConditioningConcat', inputs: { conditioning_to: ['6b0', 0], conditioning_from: ['6b1', 0] } },
    6: { class_type: 'ConditioningConcat', inputs: { conditioning_to: ['6j1', 0], conditioning_from: ['6b2', 0] } },
  });
  const tail = { 6: { class_type: 'CLIPTextEncode', inputs: { text: 'score_9, BREAK', clip: ['4', 1] } } };
  applyBreaks(tail, '6');
  assert.deepEqual(plain(tail), { 6: { class_type: 'CLIPTextEncode', inputs: { text: 'score_9', clip: ['4', 1] } } });
  const plainGraph = { 7: { class_type: 'CLIPTextEncode', inputs: { text: 'blurry', clip: ['4', 1] } } };
  applyBreaks(plainGraph, '7');
  assert.deepEqual(plain(plainGraph), { 7: { class_type: 'CLIPTextEncode', inputs: { text: 'blurry', clip: ['4', 1] } } });
});

test('Anima: own family, Turbo by file name, found early from the name', () => {
  assert.equal(workflowFamily({ modelProfile: 'Anima' }), 'anima');
  assert.equal(workflowFamily({ modelProfile: 'Anima Turbo' }), 'anima');
  assert.equal(resolveProfile('anima_turboV11.safetensors', 'Anima', false), 'Anima Turbo');
  assert.equal(resolveProfile('anima_aestheticV11.safetensors', 'Anima', false), 'Anima');
  // Still waiting for CivitAI: an Anima name is enough, an SD guess is not.
  assert.equal(resolveProfile('anima-base-v1.0.safetensors', 'Unknown', true), 'Anima');
  assert.equal(resolveProfile('ponyDiffusion.safetensors', 'Unknown', true), undefined);
});

test('SD <-> Anima: each side keeps its own sampler settings', () => {
  const sd = { width: 832, height: 1216, steps: 12, cfg: 8.6, sampler: 'euler_ancestral', scheduler: 'normal', vae: 'sdxl_vae.safetensors', modelProfile: 'Pony' };
  const toTurbo = plain(profileTransition(sd, 'Pony', 'Anima Turbo'));
  assert.deepEqual(toTurbo, {
    modelProfile: 'Anima Turbo',
    typeSettings: { sd: { width: 832, height: 1216, steps: 12, cfg: 8.6, sampler: 'euler_ancestral', scheduler: 'normal', vae: 'sdxl_vae.safetensors' } },
    width: 1024, height: 1024, steps: 10, cfg: 1, sampler: 'er_sde', scheduler: 'simple', vae: 'qwen_image_vae.safetensors',
    textEncoder: 'qwen_3_06b_base.safetensors',
  });
  // Turbo -> Aesthetic stays in the group: untouched values follow, a hand-set cfg stays.
  const anima = { ...sd, ...toTurbo, cfg: 1.5 };
  assert.deepEqual(plain(profileTransition(anima, 'Anima Turbo', 'Anima')), { modelProfile: 'Anima', steps: 30 });
  // Back to Pony: the SD values come back as they were; the Anima ones are kept for next time.
  const back = plain(profileTransition({ ...anima, steps: 30 }, 'Anima', 'Pony'));
  assert.equal(back.width, 832); assert.equal(back.height, 1216); assert.equal(back.steps, 12); assert.equal(back.cfg, 8.6);
  assert.equal(back.sampler, 'euler_ancestral'); assert.equal(back.vae, 'sdxl_vae.safetensors');
  assert.equal(back.typeSettings.anima.cfg, 1.5);
});

test('LoRA / embedding / VAE fit', () => {
  const pony = MODEL_PROFILES.Pony;
  assert.equal(bucketFits(pony, 'Pony'), true);
  assert.equal(bucketFits(pony, 'Illustrious'), false);
  assert.equal(bucketFits(pony, 'Unknown'), true);
  assert.equal(bucketFits(null, 'Flux'), true);
  assert.equal(bucketFits(MODEL_PROFILES.Illustrious, 'NoobAI'), true);
  assert.equal(vaeFits(pony, 'SDXL'), true);
  assert.equal(vaeFits(pony, 'SD 1.5'), false);
  assert.equal(vaeFits(pony, 'Flux'), false);
  assert.equal(vaeFits(MODEL_PROFILES['SD 1.5'], 'SD 1.5'), true);
});
