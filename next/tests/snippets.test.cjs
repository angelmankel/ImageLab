// Snippet chips + browser pure helpers (src/screens/image/snippets/snippetLogic.ts): chips keep the
// library's order, categories only show when they have snippets, search, and the Undo list helpers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const L = load('src/screens/image/snippets/snippetLogic.ts');

const snip = (id, over = {}) => ({ id, name: id, tag: '', text: `${id} text`, weight: 1, kind: 'positive', categoryId: 'quality', ...over });
const cats = [{ id: 'uncategorized', name: 'Uncategorized' }, { id: 'quality', name: 'Quality' }, { id: 'style', name: 'Style' }, { id: 'empty', name: 'Empty' }];
const snippets = [
  snip('sharp'),
  snip('film', { categoryId: 'style' }),
  snip('blurry', { kind: 'negative', categoryId: 'quality' }),
  snip('preset', { categoryId: 'style', layers: [{ kind: 'positive', text: 'a', tag: '', weight: 1, on: true }, { kind: 'negative', text: 'b', tag: '', weight: 1, on: true }] }),
  snip('orphan', { categoryId: 'gone' }),
  snip('hdr'),
];
const ids = (l) => l.map((s) => s.id);

test('ofKind: the kind itself, or a preset with a part of that kind', () => {
  assert.deepEqual(ids(L.ofKind(snippets, 'positive')), ['sharp', 'film', 'preset', 'orphan', 'hdr']);
  assert.deepEqual(ids(L.ofKind(snippets, 'negative')), ['blurry', 'preset']);
});

test('categoriesWith keeps the library order and drops empty ones; orphans land in Uncategorized', () => {
  assert.deepEqual(L.categoriesWith(cats, L.ofKind(snippets, 'positive')).map((c) => c.id), ['uncategorized', 'quality', 'style']);
  assert.deepEqual(L.categoriesWith(cats, L.ofKind(snippets, 'negative')).map((c) => c.id), ['quality', 'style']);
  assert.deepEqual(L.categoriesWith(cats, []), []);
});

test('inCategory: library order, never re-sorted by in-prompt or recents', () => {
  const pos = L.ofKind(snippets, 'positive');
  assert.deepEqual(ids(L.inCategory(pos, cats, 'quality')), ['sharp', 'hdr']);
  assert.deepEqual(ids(L.inCategory(pos, cats, 'uncategorized')), ['orphan']);
  assert.deepEqual(ids(L.inCategory(pos, cats, 'empty')), []);
});

test('categoryCounts totals and in-prompt per category', () => {
  const c = L.categoryCounts(L.ofKind(snippets, 'positive'), cats, new Set(['hdr', 'film']));
  assert.deepEqual(c.get('quality'), { total: 2, on: 1 });
  assert.deepEqual(c.get('style'), { total: 2, on: 1 });
  assert.deepEqual(c.get('uncategorized'), { total: 1, on: 0 });
  assert.equal(c.get('empty'), undefined);
});

test('pickTab keeps a saved tab that still exists, else the first', () => {
  const avail = L.categoriesWith(cats, L.ofKind(snippets, 'positive'));
  assert.equal(L.pickTab('style', avail), 'style');
  assert.equal(L.pickTab('empty', avail), 'uncategorized');
  assert.equal(L.pickTab(undefined, avail), 'uncategorized');
  assert.equal(L.pickTab('x', []), '');
});

test('inPromptIds / inPromptSnippets follow originSnippetId, in library order', () => {
  const layers = [{ id: 'l1', originSnippetId: 'hdr' }, { id: 'l2' }, { id: 'l3', originSnippetId: 'sharp' }, { id: 'l4', originSnippetId: 'sharp' }];
  assert.deepEqual([...L.inPromptIds(layers)].sort(), ['hdr', 'sharp']);
  assert.deepEqual(ids(L.inPromptSnippets(snippets, layers)), ['sharp', 'hdr']);
});

test('previewText joins preset parts', () => {
  assert.equal(L.previewText(snippets[0]), 'sharp text');
  assert.equal(L.previewText(snippets[3]), 'a · b');
});

test('searchSnippets matches every word against name, text and preset parts, case-insensitive', () => {
  assert.deepEqual(ids(L.searchSnippets(snippets, '')), ids(snippets));
  assert.deepEqual(ids(L.searchSnippets(snippets, 'SHARP')), ['sharp']);
  assert.deepEqual(ids(L.searchSnippets(snippets, 'film text')), ['film']);
  assert.deepEqual(ids(L.searchSnippets(snippets, 'b')), ['blurry', 'preset']);
  assert.deepEqual(ids(L.searchSnippets(snippets, 'nothing here')), []);
});

test('indexOfId / insertAt put a deleted snippet back where it was', () => {
  const i = L.indexOfId(snippets, 'film');
  assert.equal(i, 1);
  const without = snippets.filter((s) => s.id !== 'film');
  assert.deepEqual(ids(L.insertAt(without, i, snippets[1])), ids(snippets));
  assert.deepEqual(ids(L.insertAt(without, -1, snippets[1])), [...ids(without), 'film']);
  assert.deepEqual(ids(L.insertAt(without, 99, snippets[1])), [...ids(without), 'film']);
  assert.equal(L.indexOfId(snippets, 'nope'), -1);
});

test('canSave needs a name and a text', () => {
  assert.equal(L.canSave('a', 'b'), true);
  assert.equal(L.canSave(' ', 'b'), false);
  assert.equal(L.canSave('a', ''), false);
});
