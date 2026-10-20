// "Model preview starts on" in the next UI: the viewer's start picture (`withStartImage`,
// `viewerStart`) and the Models screen's NSFW mask applied to the popular list.
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');

const modelHash = load('../src/lib/modelHash.ts');
const P = load('../src/lib/previewOrder.ts', { './modelHash': modelHash, './civitai': { fetchCivitaiImages: () => Promise.resolve(null) } });
const Q = require('../src/screens/models/civitaiQuery.ts');
const L = load('src/screens/modelViewer/modelViewerLogic.ts', { '@/lib/modelHash': modelHash });
const H = load('src/app/usePreviewOrder.ts');

const C = 'https://image.civitai.com/acct';
const img = (id, extra = {}) => ({ url: `${C}/${id}/original=true/${id}.jpeg`, ...extra });

test('withStartImage: the tapped picture first — moved when the gallery has it, else put in front', () => {
  const g = [img('a'), img('b'), img('c')];
  assert.strictEqual(L.withStartImage(g, null, P.imageKey), g);
  assert.strictEqual(L.withStartImage(g, img('a'), P.imageKey), g);
  // same picture under another url form: moved, the gallery's object (with meta) kept
  const moved = L.withStartImage(g, { url: `${C}/c/width=450/c.jpeg` }, P.imageKey);
  assert.deepStrictEqual(moved.map((x) => x.url), [g[2].url, g[0].url, g[1].url]);
  assert.strictEqual(moved[0], g[2]);
  const added = L.withStartImage(g, img('z'), P.imageKey);
  assert.deepStrictEqual(added.map((x) => x.url.split('/')[4]), ['z', 'a', 'b', 'c']);
  assert.deepStrictEqual(L.withStartImage([], img('z'), P.imageKey).length, 1);
});

test('viewerStart: the first picture with its version, never a local generation', () => {
  assert.strictEqual(H.viewerStart([]), undefined);
  assert.strictEqual(H.viewerStart([{ url: 'http://pod/view?f=1', local: true }, img('a')]), undefined);
  assert.deepStrictEqual(H.viewerStart([img('a', { nsfwLevel: 1 })], 42), { ...img('a', { nsfwLevel: 1 }), versionId: 42 });
  assert.deepStrictEqual(H.viewerStart([img('a')]), img('a'));
});

test('the Models screen mask keeps adult popular pictures out of a safe preview', () => {
  const curated = [img('cur', { nsfwLevel: 1 })];
  const popular = [img('x', { nsfwLevel: 'X' }), img('soft', { nsfwLevel: 'Soft' }), img('safe', { nsfwLevel: 'None' })];
  const order = (mask) => P.orderPreviewImages(curated, { source: 'popular', popular, allow: (i) => !Q.isBeyondMask(i.nsfwLevel, mask) }).map((i) => i.url.split('/')[4]);
  assert.deepStrictEqual(order(Q.maskForLevel('none')), ['safe', 'cur']);
  assert.deepStrictEqual(order(Q.maskForLevel('soft')), ['soft', 'safe', 'cur']);
  assert.deepStrictEqual(order(Q.ALL_LEVELS), ['x', 'soft', 'safe', 'cur']);
});
