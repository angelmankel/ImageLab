// "Model preview starts on": the popular cache (key, merge, sessionStorage, one request per
// version) and the ordering (`orderPreviewImages` on `orderForPreview`). previewOrder.ts imports
// civitai.ts (the network) — stubbed here with a counting fake.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function load(name, modules = {}, context = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (m) => modules[m] ?? {}, ...context });
  return exports;
}
const modelHash = load('modelHash');
const plain = (v) => JSON.parse(JSON.stringify(v));

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

/** A fresh module (its own memory cache) over `storage`, with a fake fetcher. */
function fresh(storage, answer) {
  const calls = [];
  const civitai = {
    fetchCivitaiImages: (versionId, cursor, nsfw, opts) => {
      calls.push({ versionId, cursor, nsfw, opts: plain(opts) });
      return Promise.resolve(typeof answer === 'function' ? answer(versionId) : answer);
    },
  };
  const P = load('previewOrder', { './civitai': civitai, './modelHash': modelHash }, { localStorage: storage });
  return { P, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

const C = 'https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA';
const cur = (id, lvl = 1) => ({ url: `${C}/${id}/original=true/${id}.jpeg`, nsfwLevel: lvl, width: 512, height: 768, meta: null });
const api = (id, lvl = 'None') => ({ id: 1, url: `${C}/${id}/original=true/${id}.jpeg`, nsfwLevel: lvl, width: 832, height: 1216, type: 'image', stats: {}, meta: {} });

test('imageKey: one CivitAI picture under any url form is one key; other urls are themselves', () => {
  const { P } = fresh(memoryStorage(), null);
  assert.equal(P.imageKey(`${C}/abc-123/original=true/5706937.jpeg`), 'abc-123');
  assert.equal(P.imageKey(`${C}/abc-123/width=450/abc-123.jpeg`), 'abc-123');
  assert.equal(P.imageKey('http://pod:8188/view?filename=a.png'), 'http://pod:8188/view?filename=a.png');
  assert.equal(P.popularKey(290640), '290640');
});

test('toPreviewImages keeps url, type, level (number or name) and size; drops url-less items', () => {
  const { P } = fresh(memoryStorage(), null);
  assert.deepEqual(plain(P.toPreviewImages([api('a', 'X'), { nsfwLevel: 1 }, null, { url: 'u', nsfwLevel: 4, type: 'video' }])), [
    { url: `${C}/a/original=true/a.jpeg`, type: 'image', nsfwLevel: 'X', width: 832, height: 1216 },
    { url: 'u', type: 'video', nsfwLevel: 4 },
  ]);
});

test('parsePopularCache drops anything malformed; mergePopular keeps the newest versions', () => {
  const { P } = fresh(memoryStorage(), null);
  assert.deepEqual(plain(P.parsePopularCache('not json')), {});
  assert.deepEqual(plain(P.parsePopularCache('[1,2]')), {});
  assert.deepEqual(plain(P.parsePopularCache(JSON.stringify({ 12: { at: 5, images: [{ url: 'a' }, { nope: 1 }] }, x: { at: 1, images: [] }, 13: { images: [] } }))),
    { 12: { at: 5, images: [{ url: 'a' }] } });
  let c = {};
  c = P.mergePopular(c, 1, [{ url: 'a' }], 10, 2);
  c = P.mergePopular(c, 2, [{ url: 'b' }], 20, 2);
  c = P.mergePopular(c, 3, [{ url: 'c' }], 30, 2);
  assert.deepEqual(Object.keys(c).sort(), ['2', '3']);
  c = P.mergePopular(c, 2, [{ url: 'b2' }], 40, 2);
  assert.deepEqual(plain(c['2']), { at: 40, images: [{ url: 'b2' }] });
});

test('orderForPreview: popular urls lead, then curated; without them it is First', () => {
  assert.deepEqual([...modelHash.orderForPreview(['a', 'b'], ['h'], 'popular', ['p', 'b'])], ['p', 'b', 'a', 'h']);
  assert.deepEqual([...modelHash.orderForPreview(['a', 'b'], ['h'], 'popular')], ['a', 'b', 'h']);
  assert.deepEqual([...modelHash.orderForPreview(['a', 'b'], ['h'], 'first', ['p'])], ['a', 'b', 'h']);
  assert.deepEqual([...modelHash.orderForPreview(['a', 'b'], ['h'], 'history', ['p'])], ['h', 'a', 'b']);
});

test('orderPreviewImages applies each setting; a picture in both lists keeps the curated object', () => {
  const { P } = fresh(memoryStorage(), null);
  const curated = [cur('a'), cur('b'), cur('c')];
  const popular = P.toPreviewImages([api('p'), api('b'), api('x', 'X')]);
  const urls = (list) => Array.from(list, (i) => i.url.split('/')[4] ?? i.url);
  assert.deepEqual(urls(P.orderPreviewImages(curated, { source: 'first', popular, history: ['H'] })), ['a', 'b', 'c']);
  assert.deepEqual(urls(P.orderPreviewImages(curated, { source: 'popular', popular: undefined })), ['a', 'b', 'c']);
  const pop = P.orderPreviewImages(curated, { source: 'popular', popular });
  assert.deepEqual(urls(pop), ['p', 'b', 'x', 'a', 'c']);
  assert.equal(pop[1], curated[1], 'the shared picture is the curated object');
  assert.equal(pop[0].nsfwLevel, 'None');
  // the mask leaves adult popular pictures out (curated ones are the caller's business)
  const allow = (i) => i.nsfwLevel !== 'X';
  assert.deepEqual(urls(P.orderPreviewImages(curated, { source: 'popular', popular, allow })), ['p', 'b', 'a', 'c']);
  const hist = P.orderPreviewImages(curated, { source: 'history', history: ['http://pod/view?f=1', 'http://pod/view?f=1', 'http://pod/view?f=2'] });
  assert.deepEqual(Array.from(hist, (i) => i.url).slice(0, 2), ['http://pod/view?f=1', 'http://pod/view?f=2']);
  assert.equal(hist[0].local, true);
  assert.equal(hist.length, 5);
  // random: the same pictures, every one once
  const rnd = P.orderPreviewImages(curated, { source: 'random', popular, history: ['H'] });
  assert.deepEqual(urls(rnd).sort(), ['a', 'b', 'c']);
});

test('historyIndex: by file name (no folder, any case), checkpoint + LoRAs + VAE, newest first, skips gone servers', () => {
  const { P } = fresh(memoryStorage(), null);
  const h = [
    { id: '1', serverId: 's', filename: 'one.png', model: 'SDXL/Pony.safetensors', workflow: { vae: 'sdxl_vae.safetensors', loras: [{ name: 'style/Ink.safetensors' }], checkpoints: [{ name: 'SDXL/Pony.safetensors' }, { name: 'mix.safetensors' }] } },
    { id: '2', serverId: 'gone', filename: 'two.png', model: 'pony.safetensors' },
    { id: '3', serverId: 's', filename: 'three.png', model: 'pony.safetensors' },
    { id: '4', serverId: 's', filename: '', model: 'pony.safetensors' },
  ];
  const idx = P.historyIndex(h, (e) => (e.serverId === 's' ? `view/${e.filename}` : null));
  assert.deepEqual([...idx.get('pony.safetensors')], ['view/one.png', 'view/three.png']);
  assert.deepEqual([...idx.get('ink.safetensors')], ['view/one.png']);
  assert.deepEqual([...idx.get('sdxl_vae.safetensors')], ['view/one.png']);
  assert.deepEqual([...idx.get('mix.safetensors')], ['view/one.png']);
  assert.equal(P.fileKey('Style\\Ink.SAFETENSORS'), 'ink.safetensors');
});

test('requestPopular: one Most-Reactions request per version, every level, cached in memory and sessionStorage', async () => {
  const storage = memoryStorage();
  const { P, calls } = fresh(storage, { items: [api('p', 'X'), api('q')], nextCursor: '2' });
  let told = 0;
  P.subscribePopular(() => told++);
  assert.equal(P.popularFor(7), undefined);
  P.requestPopular(7);
  P.requestPopular(7); // in flight: no second request
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { versionId: 7, cursor: null, nsfw: 'all', opts: { sort: 'Most Reactions', limit: P.POPULAR_LIMIT, everyLevel: true } });
  await tick();
  assert.equal(told, 1);
  const list = P.popularFor(7);
  assert.deepEqual(Array.from(list, (i) => i.nsfwLevel), ['X', 'None']);
  assert.equal(P.popularFor(7), list, 'a stable array');
  P.requestPopular(7); // cached
  assert.equal(calls.length, 1);
  assert.ok(storage.getItem(P.POPULAR_STORE_KEY).includes('"7"'));
  // a reload in the same tab: read from sessionStorage, no request
  const again = fresh(storage, null);
  assert.equal(again.P.popularFor(7).length, 2);
  again.P.requestPopular(7);
  assert.equal(again.calls.length, 0);
  P.requestPopular(null);
  assert.equal(calls.length, 1);
});

test('a failed request is not retried this page load, and leaves no list (curated order stays)', async () => {
  const { P, calls } = fresh(memoryStorage(), null);
  P.requestPopular(9);
  await tick();
  assert.equal(P.popularFor(9), undefined);
  P.requestPopular(9);
  assert.equal(calls.length, 1);
  const rejecting = fresh(memoryStorage(), () => Promise.reject(new Error('down')));
  rejecting.P.requestPopular(9);
  await tick();
  assert.equal(rejecting.P.popularFor(9), undefined);
});

test('seedPopular takes a gallery page fetched elsewhere, so no request follows', async () => {
  const { P, calls } = fresh(memoryStorage(), null);
  P.seedPopular(5, [api('g1'), api('g2')]);
  assert.equal(P.popularFor(5).length, 2);
  P.requestPopular(5);
  assert.equal(calls.length, 0);
  P.seedPopular(5, [api('other')]); // never overwrites
  assert.equal(P.popularFor(5)[0].url.includes('g1'), true);
  // works without sessionStorage (blocked / private): memory only
  const bare = load('previewOrder', { './civitai': { fetchCivitaiImages: () => Promise.resolve(null) }, './modelHash': modelHash });
  bare.seedPopular(6, [api('m')]);
  assert.equal(bare.popularFor(6).length, 1);
});

test('parsePopularCache drops lists older than a week when given the time', () => {
  const { P } = fresh(memoryStorage(), null);
  const day = 24 * 60 * 60 * 1000;
  const raw = JSON.stringify({ '1': { at: 0, images: [{ url: 'a' }] }, '2': { at: 6 * day, images: [{ url: 'b' }] } });
  assert.deepEqual(Object.keys(P.parsePopularCache(raw, 8 * day)), ['2']);
  assert.deepEqual(Object.keys(P.parsePopularCache(raw)).sort(), ['1', '2'], 'no time given: nothing is aged out');
});
