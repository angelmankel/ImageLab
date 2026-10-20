// The desktop filter bar's chip readings (src/screens/models/filterSummary.ts): "Base: SDXL +2",
// lit when not at the default, what lives under More, the active-filter row.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const Q = require('../src/screens/models/civitaiQuery.ts');
const S = load('src/screens/models/filterSummary.ts', { './civitaiQuery': Q });

const F = (patch = {}) => ({ ...Q.DEFAULT_FILTERS, ...patch });

test('summarize: none, one, first +n', () => {
  assert.equal(S.summarize([], 'Any'), 'Any');
  assert.equal(S.summarize(['SDXL'], 'Any'), 'SDXL');
  assert.equal(S.summarize(['SDXL', 'Pony', 'Flux.1 D'], 'Any'), 'SDXL +2');
});

test('row types + other types cover every model type once', () => {
  assert.deepEqual([...S.ROW_TYPES, ...S.OTHER_TYPES].sort(), [...Q.MODEL_TYPES].sort());
  assert.deepEqual(S.OTHER_TYPES, ['DoRA', 'AestheticGradient', 'Detection', 'Other']);
});

test('source chip: Downloaded / Favourites / account favourites, All CivitAI at rest', () => {
  assert.deepEqual(S.sourceChip('civitai', F()), { value: 'All CivitAI', on: false, count: 0 });
  assert.deepEqual(S.sourceChip('installed', F()), { value: 'Downloaded', on: true, count: 1 });
  assert.equal(S.sourceChip('installed', F({ favorites: true })).value, 'Downloaded +1');
  assert.equal(S.sourceChip('civitai', F({ accountFavorites: true })).value, 'CivitAI favourites');
});

test('type chip: Any, labels, kind lock', () => {
  assert.deepEqual(S.typeChip(F(), null), { value: 'Any', on: false, count: 0, locked: false });
  assert.equal(S.typeChip(F({ types: ['LORA', 'LoCon'] }), null).value, 'LoRA +1');
  const locked = S.typeChip(F({ types: ['LORA'] }), 'checkpoint');
  assert.equal(locked.value, 'Checkpoints');
  assert.equal(locked.locked, true);
  assert.equal(locked.on, true);
});

test('base chip: short labels in menu order', () => {
  assert.equal(S.baseChip(F()).value, 'Any');
  assert.equal(S.baseChip(F({ baseModels: ['Pony', 'SDXL 1.0', 'Chroma'] })).value, 'SDXL +2');
  assert.equal(S.baseChip(F({ baseModels: ['Wan Video 2.2 T2V-A14B'] })).value, 'Wan 2.2');
  assert.equal(S.hasMoreBase(F({ baseModels: ['SDXL 1.0'] })), false);
  assert.equal(S.hasMoreBase(F({ baseModels: ['Chroma'] })), true);
});

test('tags chip', () => {
  assert.deepEqual(S.tagsChip([]), { value: 'Any', on: false, count: 0 });
  assert.equal(S.tagsChip(['anime', 'style']).value, '#anime +1');
});

test('more chip: everything without its own place', () => {
  assert.deepEqual(S.moreChip(F()), { value: '', on: false, count: 0 });
  assert.deepEqual(S.moreChip(F({ query: 'x', types: ['LORA'], baseModels: ['Pony'], period: 'Week', nsfwMask: 1, favorites: true, accountFavorites: true })), { value: '', on: false, count: 0 });
  const m = S.moreChip(F({ followed: true, earlyAccess: 'only', fp: ['fp16'] }));
  assert.equal(m.value, 'Followed +2');
  assert.equal(m.count, 3);
  assert.equal(S.isMoreKey('username'), true);
  assert.equal(S.isMoreKey('baseModels'), false);
});

test('active chips: Downloaded first, kind-locked types left out', () => {
  assert.deepEqual(S.activeChips(F(), 'civitai', null), []);
  assert.deepEqual(S.activeChips(F({ types: ['Checkpoint'] }), 'installed', null).map((c) => c.key), ['source', 'types']);
  assert.deepEqual(S.activeChips(F({ types: ['Checkpoint'], followed: true }), 'civitai', 'lora').map((c) => c.label), ['Followed']);
});
