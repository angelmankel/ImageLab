// Fix list 2 item 36: every picture slot has Paste. The clipboard reader (pure), and a review guard:
// a new drop zone without Paste fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./_load.cjs');
const P = load('src/dnd/payload.ts');
const C = load('src/compose/clipboard.ts', { '~/dnd': P });

const item = (types, data) => ({ types, getType: async (t) => (t.startsWith('image/') ? new Blob(['x'], { type: t }) : new Blob([data[t] ?? ''], { type: t })) });

test('a picture on the clipboard wins over text', async () => {
  const r = await C.fromClipboardItems([item(['text/plain'], { 'text/plain': 'hello' }), item(['image/png'], {})]);
  assert.equal(r.item.kind, 'file');
  assert.equal(r.item.file.type, 'image/png');
  assert.equal(r.item.name, 'pasted.png');
  const j = await C.fromClipboardItems([item(['image/jpeg'], {})]);
  assert.equal(j.item.name, 'pasted.jpg');
});

test('a copied link is fetched like a dropped URL', async () => {
  const r = await C.fromClipboardItems([item(['text/plain'], { 'text/plain': '  https://civitai.com/img/a.jpeg  ' })]);
  assert.deepEqual(r.item, { kind: 'url', url: 'https://civitai.com/img/a.jpeg', name: 'a.jpeg', payload: null });
  const h = await C.fromClipboardItems([item(['text/html'], { 'text/html': '<p><img src="https://h/view?filename=b.png&amp;type=output"></p>' })]);
  assert.equal(h.item.url, 'https://h/view?filename=b.png&type=output');
  assert.equal(h.item.name, 'b.png');
});

test('nothing usable says why', async () => {
  assert.deepEqual(await C.fromClipboardItems([]), { miss: 'empty' });
  assert.deepEqual(await C.fromClipboardItems([item(['text/plain'], { 'text/plain': 'just words' })]), { miss: 'text' });
  assert.equal(C.missOfError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(C.missOfError({ name: 'DataError' }), 'empty');
  for (const k of ['empty', 'text', 'denied', 'unsupported']) assert.ok(C.PASTE_MISS[k].length < 90, k);
});

// ---- review guard ----
const SRC = path.join(__dirname, '..', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name)) out.push(path.relative(SRC, p).split(path.sep).join('/'));
  }
  return out;
}

test('the shared drop zone always renders Paste (empty and filled, phone and desktop, small too)', () => {
  const s = read('compose/ImageDropZone.tsx');
  const uses = s.match(/<PasteButton\b/g) ?? [];
  assert.ok(uses.length >= 2, 'ImageDropZone must render <PasteButton> in both the empty and the filled state');
  assert.ok(!/(&&|\?)\s*<PasteButton\b/.test(s), 'PasteButton must never be conditional in ImageDropZone');
  assert.match(s, /usePaste\(/, 'ImageDropZone must take Ctrl+V through usePaste');
});

// Drop targets that are NOT picture slots (they file / route a picture, they do not hold one).
const NOT_A_SLOT = new Set([
  'dnd/payload.ts', 'dnd/useImageDrop.ts', 'dnd/railDrop.ts', // the drag layer itself / new step from a drop
  'screens/image/topbar/SessionTabs.tsx', // drop on a tab = new session
  'screens/image/collections/CollectionTile.tsx', // drop on a collection tile = move it there (paste: open the collection)
  'screens/image/collections/CollectionsRow.tsx', // "+" tile = new collection with the dropped picture
]);

test('every place that takes a picture has Paste (ImageDropZone, or usePaste + PasteButton)', () => {
  const missing = [];
  for (const rel of walk(SRC)) {
    if (rel.startsWith('compose/') || NOT_A_SLOT.has(rel)) continue;
    const s = read(rel);
    const takes = /useImageDrop\(/.test(s) || /type="file"[^>]*accept="image/.test(s) || /accept="image[^"]*"[^>]*type="file"/.test(s);
    if (!takes) continue;
    const hasPaste = /<ImageDropZone\b/.test(s) || (/usePaste\(/.test(s) && /<PasteButton\b/.test(s));
    if (!hasPaste) missing.push(rel);
  }
  assert.deepEqual(missing, [], `these take a picture without Paste — use ImageDropZone, or usePaste + PasteButton: ${missing.join(', ')}`);
});
