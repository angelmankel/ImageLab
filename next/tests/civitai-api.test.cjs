// The Models screen's pure layer (src/screens/models/civitaiQuery.ts): the query builder, the NSFW
// mask, installed matching, the active-filter summary. Required straight from TypeScript (Node
// strips the types; the module imports nothing).
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../src/screens/models/civitaiQuery.ts');

const params = (s) => new URLSearchParams(s);
const base = () => ({ ...Q.DEFAULT_FILTERS });

test('defaults: only limit, sort, period and nsfw go out (never browsingLevel: /models rejects it)', () => {
  const p = params(Q.buildModelsQuery(base()));
  assert.deepEqual([...p.keys()].sort(), ['limit', 'nsfw', 'period', 'sort']);
  assert.equal(p.get('limit'), '40');
  assert.equal(p.get('sort'), 'Most Downloaded');
  assert.equal(p.get('period'), 'AllTime');
  assert.equal(p.get('nsfw'), 'true');
  assert.equal(p.get('browsingLevel'), null);
});

test('every /models parameter is wired', () => {
  const f = {
    ...base(), query: ' cat ', tag: 'anime', username: 'wai', types: ['Checkpoint', 'LORA'],
    baseModels: ['Illustrious', 'SDXL 1.0'], sort: 'Newest', period: 'Week', nsfwMask: 63, rating: 4,
    accountFavorites: true, followed: true, hidden: true, earlyAccess: 'only', supportsGeneration: true,
    primaryFileOnly: true, allowNoCredit: true, allowDerivatives: true, allowDifferentLicenses: true,
    commercialUse: ['Rent', 'Sell'], fileFormats: ['SafeTensor'], checkpointType: 'Merge', ids: [1, 22],
  };
  const p = params(Q.buildModelsQuery(f, { limit: 100, cursor: 'abc' }));
  assert.equal(p.get('query'), 'cat');
  assert.equal(p.get('tag'), 'anime');
  assert.equal(p.get('username'), 'wai');
  assert.deepEqual(p.getAll('types'), ['Checkpoint', 'LORA']);
  assert.deepEqual(p.getAll('baseModels'), ['Illustrious', 'SDXL 1.0']);
  assert.equal(p.get('sort'), 'Newest');
  assert.equal(p.get('period'), null, 'a text search is all-time: no period goes out');
  assert.equal(p.get('rating'), '4');
  for (const k of ['favorites', 'followed', 'hidden', 'earlyAccess', 'supportsGeneration', 'primaryFileOnly', 'allowNoCredit', 'allowDerivatives', 'allowDifferentLicenses']) {
    assert.equal(p.get(k), 'true', k);
  }
  assert.deepEqual(p.getAll('allowCommercialUse'), ['Rent', 'Sell']);
  assert.deepEqual(p.getAll('fileFormats'), ['SafeTensor']);
  assert.equal(p.get('checkpointType'), 'Merge');
  assert.deepEqual(p.getAll('ids'), ['1', '22']);
  assert.equal(p.get('limit'), '100');
  assert.equal(p.get('cursor'), 'abc');
  assert.equal(p.get('page'), null, 'cursor wins over page');
  // X = every level: nsfw on, no mask needed
  assert.equal(p.get('nsfw'), 'true');
  assert.equal(p.get('browsingLevel'), null);
});

test('page is used when there is no cursor; limit is clamped', () => {
  const p = params(Q.buildModelsQuery(base(), { page: 3, limit: 500 }));
  assert.equal(p.get('page'), '3');
  assert.equal(p.get('limit'), '100');
  assert.equal(params(Q.buildModelsQuery(base(), { page: 1 })).get('page'), null);
});

test('NSFW "None" asks the API to drop NSFW models; client-only filters never go out', () => {
  const p = params(Q.buildModelsQuery({ ...base(), nsfwMask: 1, fp: ['fp16'], installed: 'only', earlyAccess: 'hide' }));
  assert.equal(p.get('nsfw'), 'false');
  assert.equal(p.get('browsingLevel'), null, 'the level mask is client-side only');
  assert.equal(p.get('fp'), null);
  assert.equal(p.get('installed'), null);
  assert.equal(p.get('earlyAccess'), null);
});

test('the catalog picks the host', () => {
  assert.ok(Q.modelsUrl(base()).startsWith('https://civitai.com/api/v1/models?'));
  assert.ok(Q.modelsUrl({ ...base(), catalog: 'red' }).startsWith('https://civitai.red/api/v1/models?'));
});

test('images query: every parameter, withMeta by default', () => {
  const p = params(Q.buildImagesQuery({ modelId: 5, modelVersionId: 9, username: 'u', postId: 3, nsfw: false, nsfwMask: 15, sort: 'Newest', period: 'Day', limit: 10, cursor: 'c' }));
  assert.equal(p.get('modelId'), '5');
  assert.equal(p.get('modelVersionId'), '9');
  assert.equal(p.get('username'), 'u');
  assert.equal(p.get('postId'), '3');
  assert.equal(p.get('nsfw'), 'false');
  assert.equal(p.get('browsingLevel'), '15');
  assert.equal(p.get('sort'), 'Newest');
  assert.equal(p.get('period'), 'Day');
  assert.equal(p.get('limit'), '10');
  assert.equal(p.get('cursor'), 'c');
  assert.equal(p.get('withMeta'), 'true');
  const both = params(Q.buildImagesQuery({ modelVersionId: 1, nsfw: 'all', withMeta: false, page: 2 }));
  assert.equal(both.get('nsfw'), 'X', 'no mask = every level: the API hides adult pictures unless asked');
  assert.equal(params(Q.buildImagesQuery({ modelVersionId: 1, nsfwMask: 15 })).get('nsfw'), 'Mature');
  assert.equal(params(Q.buildImagesQuery({ modelVersionId: 1, nsfwMask: 7 })).get('nsfw'), 'Soft');
  assert.equal(params(Q.buildImagesQuery({ modelVersionId: 1, nsfwMask: 1 })).get('nsfw'), 'None');
  assert.equal(both.get('withMeta'), null);
  assert.equal(both.get('page'), '2');
});

test('tags / creators list query', () => {
  const p = params(Q.buildListQuery({ query: 'ani', limit: 5, page: 2 }));
  assert.equal(p.get('query'), 'ani');
  assert.equal(p.get('limit'), '5');
  assert.equal(p.get('page'), '2');
});

test('NSFW mask ↔ picker level', () => {
  assert.equal(Q.maskForLevel('none'), 1);
  assert.equal(Q.maskForLevel('soft'), 7);
  assert.equal(Q.maskForLevel('mature'), 15);
  assert.equal(Q.maskForLevel('x'), 63);
  assert.equal(Q.levelForMask(1), 'none');
  assert.equal(Q.levelForMask(7), 'soft');
  assert.equal(Q.levelForMask(3), 'soft');
  assert.equal(Q.levelForMask(8), 'mature');
  assert.equal(Q.levelForMask(32), 'x');
  // an unrated item counts as G; an R item fails Soft and passes Mature
  assert.equal(Q.passesMask(0, 1), true);
  assert.equal(Q.passesMask(8, 7), false);
  assert.equal(Q.passesMask(8, 15), true);
  assert.equal(Q.passesMask(8 | 1, 7), true, 'a model spanning G..R overlaps Soft');
  assert.equal(Q.isBeyondMask(16, 7), true);
  assert.equal(Q.isBeyondMask(1, 7), false);
  assert.equal(Q.isBeyondMask(0, 1), false);
  // item 27: NSFW covered by default, never once opted in, unless beyond the Max rating
  assert.equal(Q.coversNsfw('X', 63, false), true);
  assert.equal(Q.coversNsfw('Mature', 63, false), true);
  assert.equal(Q.coversNsfw('Soft', 63, false), false);
  assert.equal(Q.coversNsfw(0, 63, false), false);
  assert.equal(Q.coversNsfw('X', 63, true), false);
  assert.equal(Q.coversNsfw(16, 7, true), true);
});

test('sanitizeFilters drops unknown sorts/types and bad masks', () => {
  const f = Q.sanitizeFilters({ sort: 'Most Buzz', types: ['Checkpoint', 'Nope'], nsfwMask: 0, ids: [1, 'x'], fp: 'bad' });
  assert.equal(f.sort, 'Most Downloaded');
  assert.deepEqual(f.types, ['Checkpoint']);
  assert.equal(f.nsfwMask, 63);
  assert.deepEqual(f.ids, [1]);
  assert.deepEqual(f.fp, []);
  assert.equal(Q.sanitizeFilters(null).period, 'AllTime');
});

test('installed matching: by hash, by server file name, by folder-less suffix, embeddings without extension', () => {
  const idx = Q.buildInstalledIndex(['abc123'], ['SDXL/foo.safetensors', 'bar.pt', 'easynegative']);
  assert.equal(Q.fileInstalled({ name: 'anything.safetensors', hashes: { SHA256: 'ABC123' } }, idx), true);
  assert.equal(Q.fileInstalled({ name: 'foo.safetensors', hashes: {} }, idx), true);
  assert.equal(Q.fileInstalled({ name: 'SDXL/foo.safetensors', hashes: {} }, idx), true);
  assert.equal(Q.fileInstalled({ name: 'easynegative.pt', hashes: {} }, idx), true);
  assert.equal(Q.fileInstalled({ name: 'nope.safetensors', hashes: {} }, idx), false);
  const m = { id: 1, modelVersions: [
    { id: 10, files: [{ name: 'foo.safetensors', type: 'Model', hashes: {} }] },
    { id: 11, files: [{ name: 'other.safetensors', type: 'Model', hashes: {} }, { name: 'foo.safetensors', type: 'Training Data', hashes: {} }] },
  ] };
  const s = Q.modelInstalled(m, idx);
  assert.deepEqual(s, { installed: 1, total: 2, versionId: 10 });
  assert.equal(Q.versionInstalled(m.modelVersions[1], idx), false, 'training data does not count');
});

test('narrowPage applies mask, early access, precision and installed', () => {
  const items = [
    { id: 1, nsfwLevel: 1, modelVersions: [{ id: 1, files: [{ name: 'a', metadata: { fp: 'fp16' } }] }] },
    { id: 2, nsfwLevel: 16, modelVersions: [{ id: 2, files: [{ name: 'b', metadata: { fp: 'fp16' } }] }] },
    { id: 3, nsfwLevel: 1, hasActivePaidAccess: true, modelVersions: [{ id: 3, files: [{ name: 'c', metadata: { fp: 'fp8' } }] }] },
    { id: 4, nsfwLevel: 1, modelVersions: [{ id: 4, files: [{ name: 'd', metadata: { fp: 'fp32' } }] }] },
  ];
  const f = { ...base(), nsfwMask: 7 };
  assert.deepEqual(Q.narrowPage(items, f).map((m) => m.id), [1, 3, 4]);
  assert.deepEqual(Q.narrowPage(items, { ...f, earlyAccess: 'hide' }).map((m) => m.id), [1, 4]);
  assert.deepEqual(Q.narrowPage(items, { ...f, fp: ['fp16', 'fp8'] }).map((m) => m.id), [1, 3]);
  const installedOf = (m) => ({ installed: m.id === 4 ? 1 : 0, total: 1 });
  assert.deepEqual(Q.narrowPage(items, { ...f, installed: 'only' }, installedOf).map((m) => m.id), [4]);
  assert.deepEqual(Q.narrowPage(items, { ...f, installed: 'hide' }, installedOf).map((m) => m.id), [1, 3]);
});

test('isEarlyAccess reads every signal', () => {
  const future = new Date(Date.now() + 86400e3).toISOString();
  const past = new Date(Date.now() - 86400e3).toISOString();
  assert.equal(Q.isEarlyAccess({ id: 1, modelVersions: [{ id: 1, earlyAccessDeadline: future }] }), true);
  assert.equal(Q.isEarlyAccess({ id: 1, modelVersions: [{ id: 1, earlyAccessDeadline: past }] }), false);
  assert.equal(Q.isEarlyAccess({ id: 1, modelVersions: [{ id: 1, paidAccess: { permanent: true } }] }), true);
  assert.equal(Q.isEarlyAccess({ id: 1, modelVersions: [{ id: 1, availability: 'EarlyAccess' }] }), true);
  assert.equal(Q.isEarlyAccess({ id: 1, modelVersions: [] }), false);
});

test('active filters: count, labels, clearing', () => {
  const f = { ...base(), types: ['Checkpoint', 'LORA'], baseModels: ['Illustrious'], nsfwMask: 15, username: 'x', fp: ['fp16'] };
  const a = Q.activeFilters(f);
  assert.deepEqual(a.map((x) => x.key), ['types', 'baseModels', 'nsfwMask', 'username', 'fp']);
  assert.equal(a[0].label, 'Checkpoint, LoRA');
  assert.equal(a[2].label, 'Up to Mature');
  assert.equal(Q.activeFilterCount(f), 5);
  assert.equal(Q.activeFilterCount(base()), 0, 'the defaults are no filters');
  const cleared = Q.clearFilter(f, 'types');
  assert.deepEqual(cleared.types, []);
  assert.equal(Q.activeFilterCount(cleared), 4);
  const all = Q.clearAllFilters({ ...f, catalog: 'red', sort: 'Newest' });
  assert.equal(Q.activeFilterCount(all), 0);
  assert.equal(all.catalog, 'red');
  assert.equal(all.sort, 'Newest');
});

test('toggleIn, folderForType, formatting', () => {
  assert.deepEqual(Q.toggleIn(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(Q.toggleIn(['a', 'b'], 'a'), ['b']);
  assert.equal(Q.folderForType('LORA'), 'loras');
  assert.equal(Q.folderForType('TextualInversion'), 'embeddings');
  assert.equal(Q.folderForType('Checkpoint'), 'checkpoints');
  assert.equal(Q.fmtCount(212_400), '212.4k');
  assert.equal(Q.fmtCount(4_000), '4k');
  assert.equal(Q.fmtCount(1_250_000), '1.3M');
  assert.equal(Q.fmtCount(312), '312');
  assert.equal(Q.fmtSizeKB(6_500 * 1024), '6.3 GB');
  assert.equal(Q.fmtSizeKB(228 * 1024), '228 MB');
  // An embedding is kilobytes (item 32: it read "0 MB").
  assert.equal(Q.fmtSizeKB(48.3), '48 KB');
  assert.equal(Q.fmtSizeKB(0.2), '1 KB');
  assert.equal(Q.fmtSizeKB(3.2 * 1024), '3.2 MB');
  assert.equal(Q.fmtSizeKB(0), '');
  assert.equal(Q.shortHash({ AutoV2: 'A1B2C3D4E5' }), 'a1b2c3d4');
  assert.equal(Q.shortHash({ SHA256: 'FFFFFFFFFF' }), 'ffffffff');
  assert.equal(Q.baseModelShort('Wan Video 2.2 T2V-A14B'), 'Wan 2.2');
  assert.equal(Q.typeLabel('LoCon'), 'LyCORIS');
});

test('planSearch: local favourites always go by ids; account favourites and followed need the key', () => {
  const f = { ...base(), favorites: true, accountFavorites: true, followed: true };
  const withKey = Q.planSearch(f, { hasKey: true, favouriteIds: [5], followedUsers: [] });
  assert.equal(withKey.filters.favorites, false);
  assert.deepEqual(withKey.filters.ids, [5]);
  assert.equal(withKey.filters.accountFavorites, true);
  assert.equal(withKey.filters.followed, true);
  assert.equal(withKey.usernames, undefined);
  const none = Q.planSearch({ ...base(), favorites: true }, { hasKey: false, favouriteIds: [], followedUsers: [] });
  assert.equal(none.empty, true);
  const local = Q.planSearch(f, { hasKey: false, favouriteIds: [5, 6], followedUsers: ['a', 'b'] });
  assert.equal(local.filters.accountFavorites, false);
  assert.equal(local.filters.followed, false);
  assert.deepEqual(local.filters.ids, [5, 6]);
  assert.deepEqual(local.usernames, ['a', 'b']);
  const p = params(Q.buildModelsQuery(local.filters));
  assert.equal(p.getAll('ids').join(), '5,6');
  assert.equal(p.get('favorites'), null);
  assert.equal(params(Q.buildModelsQuery(withKey.filters)).get('favorites'), 'true');
  const named = Q.planSearch({ ...base(), followed: true, username: 'zed' }, { hasKey: false, favouriteIds: [], followedUsers: ['a'] });
  assert.equal(named.usernames, undefined, 'an explicit creator wins');
});

test('the picker kind locks the types; the first chosen tag is the API tag', () => {
  assert.deepEqual(Q.kindTypes('lora'), ['LORA', 'LoCon', 'DoRA']);
  assert.deepEqual(Q.kindTypes('vae'), ['VAE']);
  assert.deepEqual(Q.kindTypes('upscale'), ['Upscaler']);
  assert.equal(Q.kindTypes(null), null);
  const f = { ...base(), types: ['Checkpoint'], tag: 'old' };
  const e = Q.effectiveFilters(f, 'embedding', ['anime', 'style']);
  assert.deepEqual(e.types, ['TextualInversion']);
  assert.equal(e.tag, 'anime');
  const free = Q.effectiveFilters(f, null, []);
  assert.deepEqual(free.types, ['Checkpoint']);
  assert.equal(free.tag, 'old');
});

test('a text search never sends a period (CivitAI answers 0 to query + Month)', () => {
  const p = params(Q.buildModelsQuery({ ...base(), query: 'pony diffusion', period: 'Month' }));
  assert.equal(p.get('query'), 'pony diffusion');
  assert.equal(p.get('period'), null);
  const q = params(Q.buildModelsQuery({ ...base(), period: 'Month' }));
  assert.equal(q.get('period'), 'Month');
});

test('image levels come as names: they map to bits for the mask checks', () => {
  assert.equal(Q.levelBits('X'), 16);
  assert.equal(Q.levelBits('None'), 1);
  assert.equal(Q.levelBits(8), 8);
  assert.equal(Q.passesMask('X', 63), true);
  assert.equal(Q.passesMask('X', 7), false);
  assert.equal(Q.isBeyondMask('Mature', 7), true);
  assert.equal(Q.isBeyondMask('Soft', 7), false);
  assert.equal(Q.nsfwEnumForMask(63), 'X');
});

test('a search inside Favourites / Account ★ never becomes a CivitAI-wide query (fix list 2, added item)', () => {
  const f = { ...Q.DEFAULT_FILTERS, query: 'pa', favorites: true };
  const plan = Q.planSearch(f, { hasKey: true, favouriteIds: [5, 6], followedUsers: [] });
  assert.equal(plan.filters.query, '');
  assert.deepEqual(plan.filters.ids, [5, 6]);
  assert.equal(Q.planSearch({ ...Q.DEFAULT_FILTERS, query: 'pa' }, { hasKey: true, favouriteIds: [], followedUsers: [] }).filters.query, 'pa');
});
