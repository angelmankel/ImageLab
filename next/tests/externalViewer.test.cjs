// List-2 item 31: the external viewer API (src/screens/viewer/externalViewer.ts) — items from
// CivitAI samples, open / page / load more / close back at the same picture.
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');

function miniZustand() {
  return { create: () => (init) => { let st; const api = { getState: () => st, setState: (p) => { st = { ...st, ...p }; } }; st = init(api.setState, api.getState); return api; } };
}
let modelClosed = 0;
const V = load('src/screens/viewer/externalViewer.ts', {
  zustand: miniZustand(),
  '~/screens/modelViewer/viewerStore': { useModelViewer: { getState: () => ({ close: () => { modelClosed++; } }) } },
});

const imgs = (n) => Array.from({ length: n }, (_, i) => ({ url: `https://image.civitai.com/x/${i}.jpeg`, meta: i % 2 ? null : { prompt: `p${i}` }, nsfw: i === 1 }));

test('toViewerItem: key, name, kind and the external meta', () => {
  const it = V.toViewerItem({ url: 'https://c/a/b/pic%201.jpeg', meta: { prompt: 'x' }, width: 512, height: 768 }, 'Model');
  assert.equal(it.key, 'https://c/a/b/pic%201.jpeg');
  assert.equal(it.filename, 'pic 1.jpeg');
  assert.equal(it.kind, 'image');
  assert.deepEqual(it.external.meta, { prompt: 'x' });
  assert.equal(it.external.source, 'Model');
  assert.equal(V.toViewerItem({ url: 'https://c/v.mp4' }).kind, 'video');
});

test('open, page (callbacks + load more near the end), close back at the picture', () => {
  const seen = []; let closedAt = -1; let more = 0;
  V.openExternalViewer({ images: imgs(5), index: 1, onIndexChange: (i) => seen.push(i), onClose: (i) => { closedAt = i; }, hasMore: true, loadMore: () => { more++; } });
  assert.equal(V.isExternalViewerOpen(), true);
  assert.equal(V.useExternalViewer.getState().index, 1);
  assert.equal(V.useExternalViewer.getState().items[1].external.nsfw, true);
  V.setExternalViewerIndex(2);
  assert.deepEqual(seen, [2]);
  assert.equal(more, 1, 'near the end asks for more');
  V.updateExternalViewer({ images: imgs(8) });
  assert.equal(V.useExternalViewer.getState().index, 2, 'keeps the shown picture');
  assert.equal(V.useExternalViewer.getState().items.length, 8);
  V.closeExternalViewer();
  assert.equal(closedAt, 2);
  assert.equal(V.isExternalViewerOpen(), false);
});

test('leave: closes, then the opener steps aside (default: the model viewer closes)', () => {
  V.openExternalViewer({ images: imgs(2) });
  V.leaveExternalViewer();
  assert.equal(modelClosed, 1);
  let left = 0;
  V.openExternalViewer({ images: imgs(2), onLeave: () => { left++; } });
  V.leaveExternalViewer();
  assert.equal(left, 1);
  assert.equal(modelClosed, 1);
});

test('nothing opens for an empty list', () => {
  V.openExternalViewer({ images: [] });
  assert.equal(V.isExternalViewerOpen(), false);
});
