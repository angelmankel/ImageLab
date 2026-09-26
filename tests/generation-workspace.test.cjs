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
const { createPass, pipelinePasses, withPipeline, appendPasses, prepareSeeds, loopbackSizes, loopbackDenoises, loopbackPasses, jobStages, applyClipSkip, loopbackRounds, lerpFrame, frameRect, frameZoom, cropPixels, croppedSize } = load('pipeline');
const { applyPromptPreset } = load('promptPresets');
const { jobActivity } = load('jobActivity');
const base = { passes: [], sampler: 'euler', scheduler: 'normal', steps: 20, cfg: 7, seed: 42, randomizeSeed: false, width: 512, height: 512, upscaleModel: '4x-AnimeSharp.pth' };
function graphFor(passes, extra = {}) {
  const graph = {};
  const result = appendPasses(graph, { ...base, passes, ...extra }, ['8', 0], ['3', 0], ['4', 0], ['4', 2], 512, 512);
  return { graph, result };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('steps execute in order, including refinement at unchanged size', () => {
  const passes = [createPass(base, 'resize', 'r'), createPass(base, 'sample', 's'), createPass(base, 'remove-bg', 'b')];
  const { graph, result } = graphFor(passes);
  assert.equal(graph.pass0.class_type, 'ImageScaleBy');
  assert.deepEqual(plain(graph.pass1encode.inputs.pixels), ['pass0', 0]);
  assert.equal(graph.pass1sample.class_type, 'KSampler');
  assert.equal(graph.pass1sample.inputs.seed, 42);
  assert.deepEqual(plain(graph.pass2.inputs.image), ['pass1decode', 0]);
  assert.deepEqual(plain(result.image), ['pass2', 0]);
});

test('background removal followed by a refine keeps the cut-out and ends transparent', () => {
  const { graph, result } = graphFor([createPass(base, 'remove-bg', 'b'), createPass(base, 'sample', 's')]);
  // The refine sees the subject on flat grey, not the original background under an alpha channel.
  assert.equal(graph.pass0.inputs.background, 'Color');
  assert.deepEqual(plain(graph.pass1encode.inputs.pixels), ['pass0', 0]);
  // The removal's mask makes the refined image transparent again.
  assert.deepEqual(plain(graph.cutoutInvert.inputs.mask), ['pass0', 1]);
  assert.deepEqual(plain(graph.cutoutJoin.inputs.image), ['pass1decode', 0]);
  assert.deepEqual(plain(result.image), ['cutoutJoin', 0]);
});

test('background removal as the last step stays a plain transparent output', () => {
  const { graph, result } = graphFor([createPass(base, 'sample', 's'), createPass(base, 'remove-bg', 'b')]);
  assert.equal(graph.pass1.inputs.background, 'Alpha');
  assert.ok(!graph.cutoutJoin);
  assert.deepEqual(plain(result.image), ['pass1', 0]);
});

test('duplicate finishing steps get separate nodes and disabled passes are bypassed', () => {
  const p = createPass(base, 'upscale', 'a');
  const { graph } = graphFor([p, { ...p, id: 'b', on: false }, { ...p, id: 'c' }]);
  assert.ok(!graph.pass1model);
  assert.deepEqual(plain(graph.pass2up.inputs.image), ['pass0size', 0]);
  assert.equal(graph.pass2size.inputs.width, 2048);
});

test('legacy finishing settings survive until edited without duplicating steps', () => {
  const old = { ...base, upscaleEnabled: true, resizeEnabled: true, resizeScale: 0.5, resizeMode: 'factor', resizeMethod: 'lanczos', removeBg: true };
  const passes = pipelinePasses(old);
  assert.deepEqual(plain(passes.map(p => p.kind)), ['upscale', 'resize', 'remove-bg']);
  assert.equal(pipelinePasses({ ...old, ...withPipeline(passes) }).length, 3);
  const { graph } = graphFor([], old);
  assert.deepEqual(plain(graph.pass1.inputs.image), ['pass0size', 0]);
});

test('new seed affects every sampling pass but preserves auto preferences', () => {
  const workflow = { ...base, passes: [createPass(base, 'sample', 's')] };
  assert.equal(prepareSeeds(workflow, false).seed, 42);
  const changed = prepareSeeds(workflow, true, () => 0.5);
  assert.notEqual(changed.seed, 42);
  assert.notEqual(changed.passes[0].seed, 42);
  assert.equal(changed.randomizeSeed, false);
  assert.equal(changed.passes[0].randomizeSeed, false);
  assert.equal(prepareSeeds(workflow, true, () => 42 / 0xFFFFFFFF).seed, 43);
});

test('single negative preset replacement keeps positives; full presets preserve weights and toggles', () => {
  let n = 0;
  const id = () => String(++n);
  const current = [{ id: 'p', kind: 'positive', text: 'keep me' }, { id: 'n', kind: 'negative', text: 'old' }];
  const snippet = { id: 'saved', kind: 'negative', text: 'new', tag: '', weight: 0.8 };
  const replaced = applyPromptPreset(current, snippet, 'replace', id);
  assert.equal(replaced[0], current[0]);
  assert.equal(replaced[1].text, 'new');
  assert.equal(applyPromptPreset(current, snippet, 'insert', id).length, 3);
  const full = { ...snippet, layers: [{ kind: 'positive', text: 'off', on: false, weight: 1.2, tag: '' }] };
  const restored = applyPromptPreset(current, full, 'replace', id);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].on, false);
  assert.equal(restored[0].weight, 1.2);
});

test('progress is numeric only during sampling and clears on terminal jobs', () => {
  const running = { status: 'running', progress: { value: 6, max: 20 } };
  assert.equal(jobActivity([running], false, true).percent, 30);
  assert.equal(jobActivity([{ status: 'running' }], false, true).percent, null);
  assert.equal(jobActivity([{ status: 'error', progress: running.progress }], false, true).active, false);
  assert.equal(jobActivity([], false, true).label, 'Ready');
  assert.equal(jobActivity([], false, false).label, 'Offline');
  assert.equal(jobActivity([{ status: 'queued' }], false, true).queued, 1);
});

test('loopback sizes grow per round, snap to 8px, and stop at the 4096px cap', () => {
  const lb = { enabled: true, iterations: 3, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7 };
  assert.deepEqual(plain(loopbackSizes(lb, 1024, 1024)), [[1280, 1280], [1600, 1600], [2000, 2000]]);
  assert.deepEqual(plain(loopbackSizes({ ...lb, iterations: 2, upscale: 2 }, 2048, 1024)).at(-1), [4096, 2048]);
});

test('loopback auto-scale denoise steps evenly from start to end, and is off by default', () => {
  const lb = { enabled: true, iterations: 4, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7 };
  assert.deepEqual(plain(loopbackDenoises(lb)), [0.5, 0.5, 0.5, 0.5]);
  const auto = { ...lb, autoDenoise: true, denoiseStart: 0.6, denoiseEnd: 0.3 };
  assert.deepEqual(plain(loopbackDenoises(auto)), [0.6, 0.5, 0.4, 0.3]);
  assert.deepEqual(plain(loopbackDenoises({ ...auto, iterations: 1 })), [0.6]);
  assert.deepEqual(plain(loopbackPasses({ ...base, loopback: auto }).map(p => p.denoise)), [0.6, 0.5, 0.4, 0.3]);
});

test('job stages count the base image, loopback rounds and live passes, and map pass nodes to them', () => {
  const passes = [createPass(base, 'sample', 'r'), { ...createPass(base, 'upscale', 'u'), on: false }, createPass(base, 'remove-bg', 'b')];
  const plan = jobStages({ ...base, passes, loopback: { enabled: true, iterations: 2, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7 } });
  assert.deepEqual(plain(plan.names), ['Base image', 'Loopback 1', 'Loopback 2', 'Refine', 'Remove background']);
  assert.equal(plan.total, 5);
  assert.equal(plan.stageOf('3'), null);
  assert.equal(plan.stageOf('pass1sample'), 3);
  assert.equal(plan.stageOf('pass2decode'), 4);
  assert.equal(plan.stageOf('pass4'), 5);
  assert.equal(plan.stageOf('cutoutJoin'), null);
  // Inpainting skips refines, so they are not counted.
  assert.equal(jobStages({ ...base, passes }, true).total, 2);
});

test('clip skip defaults to -2 and -1 leaves the checkpoint CLIP untouched', () => {
  const graph = {};
  assert.deepEqual(plain(applyClipSkip(graph, {}, ['4', 1])), ['clipskip', 0]);
  assert.equal(graph.clipskip.class_type, 'CLIPSetLastLayer');
  assert.equal(graph.clipskip.inputs.stop_at_clip_layer, -2);
  assert.deepEqual(plain(graph.clipskip.inputs.clip), ['4', 1]);
  const off = {};
  assert.deepEqual(plain(applyClipSkip(off, { clipSkip: -1 }, ['4', 1])), ['4', 1]);
  assert.ok(!off.clipskip);
  const three = {};
  applyClipSkip(three, { clipSkip: -3 }, ['4', 1]);
  assert.equal(three.clipskip.inputs.stop_at_clip_layer, -3);
});

test('prompt presets put the model family quality tags first and guess the family from the checkpoint', () => {
  const { presetPrompt, familyForCheckpoint, PROMPT_PRESETS, PRESET_CATEGORIES } = load('promptLibrary');
  assert.equal(familyForCheckpoint('ponyRealism_V22.safetensors'), 'pony');
  assert.equal(familyForCheckpoint('matureCitronIL_Unstable30.safetensors'), 'illustrious');
  assert.equal(familyForCheckpoint('wai-illustrious-sdxl.safetensors'), 'illustrious');
  assert.equal(familyForCheckpoint('hexus_etnix.safetensors'), 'plain');
  const p = PROMPT_PRESETS[0];
  assert.ok(presetPrompt(p, 'pony').positive.startsWith('score_9, score_8_up, score_7_up, '));
  assert.ok(presetPrompt(p, 'pony').positive.endsWith(p.positive));
  assert.ok(presetPrompt(p, 'illustrious').negative.startsWith('worst quality'));
  assert.equal(new Set(PROMPT_PRESETS.map(x => x.id)).size, PROMPT_PRESETS.length);
  for (const x of PROMPT_PRESETS) assert.ok(PRESET_CATEGORIES.includes(x.category), x.id);
});

test('snippet library ids are unique and every snippet sits in a known category', () => {
  const { librarySnippets, LIBRARY_CATEGORIES } = load('snippetLibrary');
  const all = librarySnippets();
  assert.equal(new Set(all.map(s => s.id)).size, all.length);
  const cats = new Set(LIBRARY_CATEGORIES.map(c => c.id));
  for (const s of all) assert.ok(cats.has(s.categoryId), s.id);
  assert.ok(all.some(s => s.id === 'pony-score') && all.some(s => s.id === 'ill-quality'));
  assert.ok(all.filter(s => s.categoryId.startsWith('neg-')).every(s => s.kind === 'negative'));
});

test('model trigger words become positive parts: cleaned, per-model state, inactive LoRAs left out', () => {
  const { modelKeywordSources, withModelKeywords } = load('modelKeywords');
  const words = { 'ck.safetensors': ['anime style, '], 'a.safetensors': ['zxc', 'ZXC', ' ', 'qwe'], 'b.safetensors': null, 'off.safetensors': ['off'] };
  const wf = {
    checkpoints: [{ name: 'ck.safetensors' }],
    loras: [{ name: 'a.safetensors', on: true }, { name: 'b.safetensors', on: true }, { name: 'off.safetensors', on: false }],
    modelKeywords: { 'a.safetensors': { on: true, weight: 1.4 }, 'ck.safetensors': { on: false, weight: 1 } },
  };
  const sources = modelKeywordSources(wf, f => words[f]);
  assert.deepEqual(plain(sources.map(s => [s.file, s.kind, s.words, s.active])), [
    ['ck.safetensors', 'checkpoint', ['anime style'], true],
    ['a.safetensors', 'lora', ['zxc', 'qwe'], true],
    ['off.safetensors', 'lora', ['off'], false],
  ]);
  const layers = withModelKeywords([{ id: 'p', kind: 'positive', on: true, text: 'cat', weight: 1, tag: '' }], wf, f => words[f]);
  assert.deepEqual(plain(layers.map(l => [l.text, l.on, l.weight])), [['cat', true, 1], ['anime style', false, 1], ['zxc, qwe', true, 1.4]]);
  const { compileLayers } = load('prompt');
  assert.equal(compileLayers(layers, 'positive'), 'cat, (zxc, qwe:1.40)');
});

test('embeddings join their own prompt side as weighted embedding: tokens; negatives start negative', () => {
  const { withEmbeddings, defaultEmbeddingTarget } = load('embeddings');
  const { compileLayers } = load('prompt');
  assert.equal(defaultEmbeddingTarget('ILXLneg'), 'negative');
  assert.equal(defaultEmbeddingTarget('Stable_Yogis_General_Negatives_V1-neg'), 'negative');
  assert.equal(defaultEmbeddingTarget('StyleEmbed'), 'positive');
  const layers = withEmbeddings([
    { id: 'p', kind: 'positive', on: true, text: 'cat', weight: 1, tag: '' },
    { id: 'n', kind: 'negative', on: true, text: 'blurry', weight: 1, tag: '' },
  ], { embeddings: [
    { id: 'a', name: 'ILXLneg', target: 'negative', strength: 1, on: true },
    { id: 'b', name: 'Style', target: 'positive', strength: 1.2, on: true },
    { id: 'c', name: 'Off', target: 'negative', strength: 1, on: false },
  ] });
  assert.equal(compileLayers(layers, 'positive'), 'cat, (embedding:Style:1.20)');
  assert.equal(compileLayers(layers, 'negative'), 'blurry, embedding:ILXLneg');
});

test('embedding names without an extension still find their hash', () => {
  const { findModelHash } = load('modelHash');
  const hashes = [
    { key: 'embeddings/ILXLneg.safetensors', filename: 'ILXLneg.safetensors', hash: 'e1' },
    { key: 'loras/ILXLneg.safetensors', filename: 'ILXLneg.safetensors', hash: 'l1' },
  ];
  assert.equal(findModelHash(hashes, 'ILXLneg')?.hash, 'e1');
  assert.equal(findModelHash(hashes, 'ILXLneg.pt'), undefined);
});

test('an embedding\'s trigger words follow its token on the same side, with their own switch and weight', () => {
  const { withEmbeddings } = load('embeddings');
  const { compileLayers } = load('prompt');
  const words = { ILXLneg: ['ILXLneg, ', 'lowres'], Style: ['stylez'], Plain: null };
  const wf = { embeddings: [
    { id: 'a', name: 'ILXLneg', target: 'negative', strength: 1, on: true },
    { id: 'b', name: 'Style', target: 'positive', strength: 1, on: true, words: { on: true, weight: 1.3 } },
    { id: 'c', name: 'Plain', target: 'positive', strength: 1, on: true },
    { id: 'd', name: 'Style', target: 'positive', strength: 1, on: true, words: { on: false, weight: 1 } },
  ] };
  const layers = withEmbeddings([], wf, n => words[n]);
  assert.equal(compileLayers(layers, 'negative'), 'embedding:ILXLneg, ILXLneg, lowres');
  assert.equal(compileLayers(layers, 'positive'), 'embedding:Style, (stylez:1.30), embedding:Plain, embedding:Style');
});

test('refine noise injection puts InjectLatentNoise+ before the sampler; 0 adds nothing; loopback carries it', () => {
  const noisy = { ...createPass(base, 'sample', 's'), noise: 0.4, seed: 42 };
  const { graph } = graphFor([noisy]);
  assert.equal(graph.pass0noise.class_type, 'InjectLatentNoise+');
  assert.deepEqual(plain(graph.pass0noise.inputs.latent), ['3', 0]);
  assert.equal(graph.pass0noise.inputs.noise_strength, 0.4);
  assert.equal(graph.pass0noise.inputs.noise_seed, 43);
  assert.deepEqual(plain(graph.pass0sample.inputs.latent_image), ['pass0noise', 0]);
  const { graph: plainGraph } = graphFor([createPass(base, 'sample', 's')]);
  assert.ok(!plainGraph.pass0noise);
  const lb = loopbackPasses({ ...base, loopback: { enabled: true, iterations: 2, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7, noise: 0.3 } });
  assert.deepEqual(plain(lb.map(p => p.noise)), [0.3, 0.3]);
});

test('loopback ramps move steps, cfg, upscale and noise from start to end; fixed values stay put', () => {
  const lb = { enabled: true, iterations: 3, upscale: 1.25, denoise: 0.5, steps: 10, cfg: 7, noise: 0,
    ramps: { steps: { start: 10, end: 20 }, cfg: { start: 7, end: 5 }, upscale: { start: 1.5, end: 1 } } };
  const r = loopbackRounds(lb);
  assert.deepEqual(plain(r.map(x => x.steps)), [10, 15, 20]);
  assert.deepEqual(plain(r.map(x => x.cfg)), [7, 6, 5]);
  assert.deepEqual(plain(r.map(x => x.upscale)), [1.5, 1.25, 1]);
  assert.deepEqual(plain(r.map(x => x.noise)), [0, 0, 0]);
  assert.deepEqual(plain(r.map(x => x.frame)), [null, null, null]);
  assert.deepEqual(plain(loopbackSizes(lb, 512, 512)), [[768, 768], [960, 960], [960, 960]]);
  const passes = loopbackPasses({ ...base, loopback: lb });
  assert.deepEqual(plain(passes.map(p => [p.steps, p.cfg, p.scale])), [[10, 7, 1.5], [15, 6, 1.25], [20, 5, 1]]);
});

test('loopback frame path: crops are relative to the previous round, so zoom never compounds', () => {
  // Old zoom-only frames still read.
  assert.deepEqual(plain(frameRect({ x: 0.5, y: 0.5, zoom: 2 })), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepEqual(plain(lerpFrame({ x: 0.5, y: 0.5, w: 1, h: 1 }, { x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, 0.5)), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  const lb = { enabled: true, iterations: 3, upscale: 1, denoise: 0.5, steps: 10, cfg: 7,
    frame: { enabled: true, start: { x: 0.5, y: 0.5, w: 1, h: 1 }, end: { x: 0.5, y: 0.5, w: 0.25, h: 0.25 } } };
  const r = loopbackRounds(lb);
  // What each round shows of the base image: ×1, ×2, ×4 — the end frame, not ×8.
  assert.deepEqual(plain(r.map(x => frameZoom(x.frame))), [1, 2, 4]);
  assert.equal(r[0].crop, null);
  // Round 2 keeps half of round 1's image; round 3 keeps half of round 2's (which is already half).
  assert.deepEqual(plain(r[1].crop), { left: 0.25, top: 0.25, width: 0.5, height: 0.5 });
  assert.deepEqual(plain(r[2].crop), { left: 0.25, top: 0.25, width: 0.5, height: 0.5 });
  // A frame reaching outside the previous one is pulled back inside it, and reported as such.
  const pan = loopbackRounds({ ...lb, iterations: 2,
    frame: { enabled: true, start: { x: 0.25, y: 0.5, w: 0.5, h: 1 }, end: { x: 0.75, y: 0.5, w: 0.5, h: 1 } } });
  assert.deepEqual(plain(pan[1].frame), { x: 0.25, y: 0.5, w: 0.5, h: 1 });
});

test('a drawn frame sets the output shape and keeps the pixel area', () => {
  const px = cropPixels({ left: 0, top: 0, width: 0.5, height: 1 }, 1024, 1024);
  assert.deepEqual(plain(px), { x: 0, y: 0, width: 512, height: 1024 });
  // Same area as 1024², in a 1:2 shape.
  assert.deepEqual(plain(croppedSize(px, 1024, 1024, 1)), [728, 1448]);
  assert.deepEqual(plain(croppedSize(px, 1024, 1024, 2, 2048)), [1024, 2048]);
  const lb = { enabled: true, iterations: 2, upscale: 1, denoise: 0.5, steps: 10, cfg: 7,
    frame: { enabled: true, start: { x: 0.5, y: 0.5, w: 1, h: 1 }, end: { x: 0.25, y: 0.5, w: 0.5, h: 1 } } };
  assert.deepEqual(plain(loopbackSizes(lb, 1024, 1024)), [[1024, 1024], [728, 1448]]);
  // graphFor starts from a 512² image: round 2 crops the left half (256×512) and renders it 1:2.
  const { graph } = graphFor([], { loopback: lb });
  assert.ok(!graph.pass0crop);
  assert.equal(graph.pass1crop.class_type, 'LatentCrop');
  assert.deepEqual(plain(graph.pass1latent.inputs.width), 360);
});

test('quick search: every query word must match; label starts beat label words beat keywords', () => {
  const { rankSpotlight, spotlightScore } = load('spotlight');
  const noop = () => {};
  const items = [
    { id: 'a', group: 'Panel', label: 'Parameters', keywords: 'sampler steps cfg', run: noop },
    { id: 'b', group: 'LoRAs', label: 'Detail Tweaker', keywords: 'add_detail.safetensors', run: noop },
    { id: 'c', group: 'Actions', label: 'Generate', keywords: 'run queue', run: noop },
    { id: 'd', group: 'Go to', label: 'Generate view', run: noop },
    { id: 'e', group: 'Snippets', label: 'Steps up', run: noop },
  ];
  assert.equal(spotlightScore(items[0], 'zzz'), 0);
  assert.deepEqual(plain(rankSpotlight(items, 'steps').map(i => i.id)), ['e', 'a']);
  assert.deepEqual(plain(rankSpotlight(items, 'gen').map(i => i.id)), ['c', 'd']);
  assert.deepEqual(plain(rankSpotlight(items, 'detail add').map(i => i.id)), ['b']);
  // Empty query keeps the given order.
  assert.deepEqual(plain(rankSpotlight(items, '').map(i => i.id)), ['a', 'b', 'c', 'd', 'e']);
});
