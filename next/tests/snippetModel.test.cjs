// Item 42: the snippet + category system's pure rules (src/screens/image/snippets/snippetModel.ts).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const M = load('src/screens/image/snippets/snippetModel.ts');
const snip = (id, categoryId, over = {}) => ({ id, name: id, text: `${id} text`, categoryId, ...over });

test('autoName: first part, no weights / brackets, a few words, capitalised', () => {
  assert.equal(M.autoName('golden hour, warm rim light'), 'Golden hour');
  assert.equal(M.autoName('(soft light:1.2), x'), 'Soft light');
  assert.equal(M.autoName('a very long first part with many many words here'), 'A very long first');
  assert.equal(M.autoName('dramatic lighting. XUER'), 'Dramatic lighting');
  assert.equal(M.autoName('   '), 'Snippet');
});

test('uniqueName / reorder', () => {
  assert.equal(M.uniqueName('Glow', ['glow', 'Glow 2']), 'Glow 3');
  assert.equal(M.uniqueName('New', []), 'New');
  assert.deepEqual(M.reorder(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(M.reorder(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
});

test('delete / merge category: snippets land in Uncategorized / the target; Uncategorized stays', () => {
  const cats = [{ id: 'uncategorized', name: 'U' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const sn = [snip('1', 'a'), snip('2', 'b'), snip('3', 'a')];
  const d = M.deleteCategory(sn, cats, 'a');
  assert.deepEqual(d.cats.map((c) => c.id), ['uncategorized', 'b']);
  assert.deepEqual(d.snippets.map((s) => s.categoryId), ['uncategorized', 'b', 'uncategorized']);
  assert.equal(M.deleteCategory(sn, cats, 'uncategorized').cats.length, 3);
  const m = M.mergeCategory(sn, cats, 'a', 'b');
  assert.deepEqual(m.cats.map((c) => c.id), ['uncategorized', 'b']);
  assert.deepEqual(m.snippets.map((s) => s.categoryId), ['b', 'b', 'b']);
  assert.equal(M.mergeCategory(sn, cats, 'a', 'nope').cats.length, 3, 'unknown target: no change');
});

test('move / duplicate / count', () => {
  const sn = [snip('1', 'a'), snip('2', 'b')];
  assert.deepEqual(M.moveSnippets(sn, new Set(['1']), 'b').map((s) => s.categoryId), ['b', 'b']);
  let n = 0;
  const d = M.duplicateSnippets(sn, new Set(['1']), () => `new${++n}`);
  assert.deepEqual(d.snippets.map((s) => s.id), ['1', 'new1', '2']);
  assert.equal(d.snippets[1].name, '1 copy');
  assert.deepEqual(d.added, ['new1']);
  const c = M.countByCategory([...sn, snip('3', 'gone')], [{ id: 'a' }, { id: 'b' }, { id: 'uncategorized' }]);
  assert.equal(c.get('uncategorized'), 1);
  assert.equal(c.get('a'), 1);
});

test('merge / move targets: never itself, same kind only unless asked, grouped, Uncategorized last', () => {
  const cats = [{ id: 'quality', name: 'Quality' }, { id: 'style', name: 'Style' }, { id: 'neg-quality', name: 'Bad' }, { id: 'mine', name: 'Mine' }, { id: 'uncategorized', name: 'U' }];
  const sn = [{ categoryId: 'mine', kind: 'negative' }, { categoryId: 'quality', kind: 'positive' }];
  assert.equal(M.categoryKind(cats[3], sn), 'negative', 'a category of only negative snippets is negative');
  assert.equal(M.categoryKind(cats[4], sn), 'any');
  const t = M.targetOptions(cats, sn, 'positive', 'quality', false, (c) => c.name);
  assert.deepEqual(t.map((o) => o.value), ['style', 'uncategorized']);
  const all = M.targetOptions(cats, sn, 'positive', 'quality', true, (c) => c.name);
  assert.deepEqual(all.map((o) => `${o.group}:${o.value}`), ['Prompt:style', 'Negative:neg-quality', 'Negative:mine', 'Other:uncategorized']);
  const fromU = M.targetOptions(cats, sn, 'any', 'uncategorized', false, (c) => c.name);
  assert.equal(fromU.some((o) => o.value === 'uncategorized'), false);
});
