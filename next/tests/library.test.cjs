// Library screen pure helpers (src/screens/library/libraryLogic.ts), loaded from the TS source.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load() {
  const exports = {};
  const src = fs.readFileSync(path.join(__dirname, '../src/screens/library/libraryLogic.ts'), 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Same realm as the asserts (deepStrictEqual compares prototypes). Type-only imports vanish in transpile.
  const time = require('./_load.cjs')('src/lib/time.ts');
  new Function('exports', 'require', code)(exports, (name) => (name === '~/lib/time' ? time : {}));
  return exports;
}
const L = load();

const entry = (over = {}) => ({
  id: 'x', serverId: 's', filename: 'a.png', subfolder: '', type: 'output', promptId: 'p',
  positive: 'a red fox in snow', negative: 'blurry', seed: 42, model: 'sdxl.safetensors', createdAt: 0, ...over,
});
const img = (key, createdAt, liked = false, over = {}) => ({ key, kind: 'image', url: `u/${key}`, filename: `${key}.png`, createdAt, liked, entry: entry({ id: key, createdAt, ...over }) });
const vid = (key, createdAt, liked = false) => ({ key, kind: 'video', url: key, filename: `${key}.mp4`, createdAt, liked });

const items = [img('a', 1, true), img('b', 3, false, { positive: 'blue whale' }), vid('v1', 2), vid('v2', 4, true)];
const cols = [{ id: 'c1', name: 'Foxes', itemIds: ['a', 'v1', 'gone'] }];
const keys = (l) => l.map((i) => i.key);

test('filter by kind', () => {
  const f = (kind) => keys(L.filterItems(items, { kind, bucket: 'all', search: '', collections: cols }));
  assert.deepEqual(f('all'), ['a', 'b', 'v1', 'v2']);
  assert.deepEqual(f('image'), ['a', 'b']);
  assert.deepEqual(f('video'), ['v1', 'v2']);
  assert.deepEqual(f('fav'), ['a', 'v2']);
});

test('filter by bucket: favourites and a collection', () => {
  const f = (bucket) => keys(L.filterItems(items, { kind: 'all', bucket, search: '', collections: cols }));
  assert.deepEqual(f('favourites'), ['a', 'v2']);
  assert.deepEqual(f('c1'), ['a', 'v1']);
  assert.deepEqual(f('missing'), []);
});

test('search matches every word across prompt, model, seed, file name', () => {
  const f = (search) => keys(L.filterItems(items, { kind: 'all', bucket: 'all', search, collections: cols }));
  assert.deepEqual(f('fox snow'), ['a']);
  assert.deepEqual(f('WHALE'), ['b']);
  assert.deepEqual(f('sdxl'), ['a', 'b']);
  assert.deepEqual(f('v2'), ['v2']);
  assert.deepEqual(f('fox whale'), []);
  assert.deepEqual(f('   '), ['a', 'b', 'v1', 'v2']);
});

test('sort newest / oldest / favourites first', () => {
  assert.deepEqual(keys(L.sortItems(items, 'newest')), ['v2', 'b', 'v1', 'a']);
  assert.deepEqual(keys(L.sortItems(items, 'oldest')), ['a', 'v1', 'b', 'v2']);
  assert.deepEqual(keys(L.sortItems(items, 'favourites')), ['v2', 'a', 'b', 'v1']);
});

test('bucket counts ignore ids that are no longer in the library', () => {
  const c = L.bucketCounts(items, cols);
  assert.equal(c.all, 4);
  assert.equal(c.favourites, 2);
  assert.equal(c.c1, 2);
});

test('bucket label', () => {
  assert.equal(L.bucketLabel('all', cols), 'All items');
  assert.equal(L.bucketLabel('favourites', cols), 'Favourites');
  assert.equal(L.bucketLabel('c1', cols), 'Foxes');
  assert.equal(L.bucketLabel('zz', cols), 'All items');
});

test('grid columns: medium is 5 wide, 3 when narrow', () => {
  assert.equal(L.gridColumns(1200, 'm'), 5);
  assert.equal(L.gridColumns(500, 'm'), 3);
  assert.equal(L.gridColumns(200, 'm'), 3);
  assert.equal(L.gridColumns(1600, 's'), 7);
  assert.equal(L.gridColumns(1600, 'l'), 3);
  assert.equal(L.gridColumns(0, 'm'), 5);
});

test('toggleKey and prunePicked', () => {
  assert.deepEqual(L.toggleKey(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(L.toggleKey(['a', 'b'], 'a'), ['b']);
  const picked = ['a', 'b'];
  assert.equal(L.prunePicked(picked, items), picked);
  assert.deepEqual(L.prunePicked(['a', 'zz'], items), ['a']);
});

test('settings cells from the workflow snapshot', () => {
  const e = entry({ workflow: { checkpoints: [{ name: 'models/illustriousXL_v20.safetensors' }], width: 1024, height: 1536, steps: 30, cfg: 6, sampler: 'dpmpp_2m' } });
  const cells = L.settingsCells(e);
  assert.deepEqual(cells.map((c) => c.label), ['Model', 'Size', 'Steps', 'CFG', 'Sampler', 'Seed']);
  assert.deepEqual(cells.map((c) => c.value), ['illustriousXL_v20', '1024 × 1536', '30', '6', 'DPM++ 2M', '42']);
  assert.equal(L.settingsCells(entry())[0].value, 'sdxl');
  assert.equal(L.settingsCells(entry())[1].value, '—');
  assert.deepEqual(L.settingsCells(undefined), []);
});

test('labels', () => {
  assert.equal(L.prettySampler('euler_ancestral'), 'Euler ancestral');
  assert.equal(L.durationLabel(4.2), '0:04');
  assert.equal(L.durationLabel(75), '1:15');
  assert.equal(L.durationLabel(NaN), '');
  const now = new Date(2026, 9, 19, 15, 0).getTime();
  assert.equal(L.whenLabel(new Date(2026, 9, 19, 14, 32).getTime(), now), 'Today · 2:32 PM');
  assert.equal(L.whenLabel(new Date(2026, 9, 18, 9, 5).getTime(), now), 'Yesterday · 9:05 AM');
  assert.match(L.whenLabel(new Date(2026, 9, 12, 18, 40).getTime(), now), /^12 Oct · 6:40 PM$/);
});
