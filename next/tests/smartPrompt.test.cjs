// Smart prompt box (items 12 + 13): the data layer read from the text (sections, ComfyUI weights,
// snippet runs), the weight edits, "/" picker, tile search / related ranking, and layer folding.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const P = load('src/screens/image/prompt/promptSections.ts');
const S = load('src/screens/image/prompt/promptSearch.ts', { './relatedWords': load('src/screens/image/prompt/relatedWords.ts') });

const slice = (t, s) => t.slice(s.start, s.end);
const edit = (t, e) => P.applyEdit(t, e);

test('parseSections: top-level commas, weights, bare groups, nested commas stay inside', () => {
  const t = 'a cat, (neon rain:1.2), (soft), (golden hour, warm light:0.8),  , end';
  const secs = P.parseSections(t);
  assert.deepEqual(secs.map((s) => slice(t, s)), ['a cat', '(neon rain:1.2)', '(soft)', '(golden hour, warm light:0.8)', 'end']);
  assert.deepEqual(secs.map((s) => s.weight), [1, 1.2, 1.1, 0.8, 1]);
  assert.equal(t.slice(secs[1].innerStart, secs[1].innerEnd), 'neon rain');
  assert.equal(t.slice(secs[3].innerStart, secs[3].innerEnd), 'golden hour, warm light');
  assert.equal(P.parseSections('(a) and (b)')[0].grouped, false, '"(a) and (b)" is not one group');
  assert.deepEqual(P.parseSections('a\nb').length, 2);
});

test('formatWeight keeps one decimal at least, two at most', () => {
  assert.equal(P.formatWeight(1.2), '1.2');
  assert.equal(P.formatWeight(1.25), '1.25');
  assert.equal(P.formatWeight(2), '2.0');
  assert.equal(P.formatWeight(0.30000000000000004), '0.3');
});

test('setPartWeight wraps, re-weights, and unwraps at 1.0', () => {
  const t = 'cat, neon rain, dog';
  const sec = P.parseSections(t)[1];
  const e1 = P.setPartWeight(t, sec, 1.1);
  const t1 = edit(t, e1);
  assert.equal(t1, 'cat, (neon rain:1.1), dog');
  assert.equal(t1.slice(e1.selStart, e1.selEnd), 'neon rain');
  const sec1 = P.parseSections(t1)[1];
  const t2 = edit(t1, P.setPartWeight(t1, sec1, sec1.weight - 0.1));
  assert.equal(t2, t, 'back to plain text at 1.0');
});

test('nudgeWeight: caret in a part, a partial selection is wrapped on its own', () => {
  const t = 'cat, neon rain';
  const parts = P.promptParts(t, [], 'positive');
  const e = P.nudgeWeight(t, parts, 8, 8, 0.1);
  assert.equal(edit(t, e), 'cat, (neon rain:1.1)');
  const e2 = P.nudgeWeight(t, parts, 10, 14, 0.1);
  assert.equal(edit(t, e2), 'cat, neon (rain:1.1)');
  const t3 = 'cat, (neon rain:1.1)';
  const p3 = P.promptParts(t3, [], 'positive');
  const e3 = P.nudgeWeight(t3, p3, 6, 15, 0.1); // the inside selected, as after a nudge
  assert.equal(edit(t3, e3), 'cat, (neon rain:1.2)');
  assert.equal(P.nudgeWeight('a, b', P.promptParts('a, b', [], 'positive'), 2, 2, 0.1), null, 'caret on the separator');
});

const snippets = [
  { id: 'gold', kind: 'positive', text: 'golden hour, warm sunlight' },
  { id: 'warm', kind: 'positive', text: 'warm sunlight' },
  { id: 'preset', kind: 'positive', text: 'x', layers: [{ kind: 'positive', text: 'film grain' }, { kind: 'negative', text: 'blurry' }] },
];

test('promptParts finds snippet runs (longest first) and weighted snippet groups', () => {
  const t = 'a cat, Golden hour,  warm sunlight, film grain, (warm sunlight:1.3)';
  const parts = P.promptParts(t, snippets, 'positive');
  assert.deepEqual(parts.map((p) => [slice(t, p), p.snippetId ?? null, p.weight]), [
    ['a cat', null, 1], ['Golden hour,  warm sunlight', 'gold', 1], ['film grain', 'preset', 1], ['(warm sunlight:1.3)', 'warm', 1.3],
  ]);
  assert.equal(P.partsBySnippet(parts).get('gold').from, 1);
  const neg = P.promptParts('blurry, lowres', snippets, 'negative');
  assert.equal(neg[0].snippetId, 'preset');
  assert.equal(P.partAt(parts, 0).from, 0);
});

test('removeRange takes one separator with it; appendPiece joins with ", "', () => {
  const t = 'a, golden hour, b';
  const p = P.parseSections(t)[1];
  assert.equal(edit(t, P.removeRange(t, p.start, p.end)), 'a, b');
  const t2 = 'a, b';
  const last = P.parseSections(t2)[1];
  assert.equal(edit(t2, P.removeRange(t2, last.start, last.end)), 'a');
  assert.equal(edit('', P.appendPiece('', 'x')), 'x');
  assert.equal(edit('a cat, ', P.appendPiece('a cat, ', 'x')), 'a cat, x');
  assert.equal(edit('a cat', P.appendPiece('a cat', 'x')), 'a cat, x');
});

test('slashQuery / replaceSlash', () => {
  assert.deepEqual(P.slashQuery('a cat, /gol', 11), { start: 7, query: 'gol' });
  assert.deepEqual(P.slashQuery('/', 1), { start: 0, query: '' });
  assert.equal(P.slashQuery('1/2', 3), null);
  assert.equal(P.slashQuery('a, /x, b', 8), null);
  const t = 'a cat /gol';
  const e = P.replaceSlash(t, 6, 10, 'golden hour');
  assert.equal(edit(t, e), 'a cat, golden hour');
  const t2 = 'a cat, /gol, b';
  assert.equal(edit(t2, P.replaceSlash(t2, 7, 11, 'golden hour')), 'a cat, golden hour, b');
  const t3 = '/g b';
  assert.equal(edit(t3, P.replaceSlash(t3, 0, 2, 'gold')), 'gold, b');
});

test('foldLayers merges the ON layers of a kind into the first, with weights; off layers go', () => {
  const L = (id, kind, text, over = {}) => ({ id, kind, text, on: true, weight: 1, tag: '', ...over });
  const layers = [L('p1', 'positive', 'a cat'), L('n1', 'negative', 'blurry'), L('p2', 'positive', 'neon', { weight: 1.2, originSnippetId: 's' }), L('p3', 'positive', 'off', { on: false })];
  const out = P.foldLayers(layers);
  assert.deepEqual(out.map((l) => [l.id, l.text]), [['p1', 'a cat, (neon:1.2)'], ['n1', 'blurry']]);
  assert.equal(P.foldLayers(out), null);
  const offFirst = P.foldLayers([L('a', 'positive', 'old', { on: false }), L('b', 'positive', 'new')]);
  assert.deepEqual(offFirst.map((l) => [l.id, l.text, l.on]), [['a', 'new', true]]);
});

test('tileName caps at a word; model-specific entries are spotted', () => {
  assert.equal(S.tileName('Golden hour'), 'Golden hour');
  assert.equal(S.tileName('Illustrious quality (short)'), 'Illustrious…');
  assert.ok(S.tileName('Supercalifragilisticexpialidocious').length <= 18);
  assert.equal(S.isModelSpecific({ id: 'ill-quality', categoryId: 'quality' }), true);
  assert.equal(S.isModelSpecific({ id: 'lib-q', categoryId: 'pony' }), true);
  assert.equal(S.isModelSpecific({ id: 'lib-q', categoryId: 'quality' }), false);
});

test('fuzzy: substring beats scatter, word start wins, no match is null', () => {
  assert.ok(S.fuzzy('gol', 'Golden hour').score > S.fuzzy('gol', 'Warm gold').score);
  assert.ok(S.fuzzy('gh', 'Golden hour'));
  assert.equal(S.fuzzy('zz', 'Golden hour'), null);
  const tiles = [{ id: 'a', name: 'Warm palette', text: 'amber, gold', categoryId: 'color', kind: 'positive' }, { id: 'b', name: 'Golden hour', text: 'x', categoryId: 'lighting', kind: 'positive' }];
  assert.deepEqual(S.searchTiles(tiles, 'gold').map((t) => t.id), ['b', 'a']);
});

test('relatedTiles ranks by typed words and the related-words table', () => {
  const tiles = [
    { id: 'neon', name: 'Neon', text: 'neon lights, glow, reflections on wet surfaces', categoryId: 'lighting', kind: 'positive' },
    { id: 'oil', name: 'Oil painting', text: 'oil painting, brush strokes', categoryId: 'style', kind: 'positive' },
    { id: 'rain', name: 'Rainy night', text: 'rain, wet streets', categoryId: 'weather', kind: 'positive' },
  ];
  const r = S.relatedTiles(tiles, 'a flooded city in the rain');
  assert.deepEqual(r.tiles.map((t) => t.id), ['rain', 'neon']);
  assert.ok(r.words.includes('rain'));
  assert.deepEqual(S.relatedTiles(tiles, '').tiles, []);
});

test('item 38: sentence-end periods and new lines split parts; numbers, weights, names, ellipses do not', () => {
  const t = 'depth of field,dramatic lighting. XUER\n(cat:1.2), 0.85 thing, embedding:foo.pt, wait... more, a…b, end.';
  const secs = P.parseSections(t).map((s) => slice(t, s));
  assert.deepEqual(secs, ['depth of field', 'dramatic lighting', 'XUER', '(cat:1.2)', '0.85 thing', 'embedding:foo.pt', 'wait... more', 'a…b', 'end']);
  // removing a part next to a period keeps the rest tidy
  const u = 'a. b. c';
  const ps = P.parseSections(u);
  assert.equal(edit(u, P.removeRange(u, ps[1].start, ps[1].end)), 'a. c');
  assert.equal(edit(u, P.removeRange(u, ps[2].start, ps[2].end)), 'a. b');
  assert.equal(P.isBreakDot('1.2', 1), false);
});

test('item 46: prompt words skip trigger tags and junk stems', () => {
  const w = S.wordsOf('color grading, s1_dram, 4ur4_illu, 8k, close-up, running cats');
  assert.ok(!w.includes('dram') && !w.includes('illu') && !w.includes('ur4'));
  assert.ok(w.includes('run') && w.includes('cat') && w.includes('close'));
});

test('item 44: movePart swaps / moves part texts, separators stay put', () => {
  const t = 'a cat, (neon:1.2). dog\nend';
  const parts = P.parseSections(t);
  const run = (e) => (e ? edit(t, e) : t);
  assert.equal(run(P.movePart(t, parts, 0, 2, 'swap')), 'dog, (neon:1.2). a cat\nend');
  assert.equal(run(P.movePart(t, parts, 3, 0, 'move')), 'end, a cat. (neon:1.2)\ndog');
  assert.equal(run(P.movePart(t, parts, 0, 4, 'move')), '(neon:1.2), dog. end\na cat');
  assert.equal(P.movePart(t, parts, 1, 1, 'move'), null);
  assert.equal(P.movePart(t, parts, 1, 2, 'move'), null);
  const e = P.movePart(t, parts, 0, 1, 'swap');
  assert.equal(run(e).slice(0, e.selStart).endsWith('a cat'), true, 'caret at the end of the moved part');
});

test('item 44 fix: drop target — swap in the middle, move at the edges / gaps, wrapped parts, no-ops', () => {
  const D = load('src/screens/image/prompt/partDrag.ts');
  const box = (left, right, row) => ({ left, right, top: row * 20, bottom: row * 20 + 18 });
  // Line 0: part0 [0,60] part1 [70,200…wraps]; line 1: part1 cont. [0,40] part2 [50,120]
  const parts = [
    { i: 0, boxes: [box(0, 60, 0)] },
    { i: 1, boxes: [box(70, 200, 0), box(0, 40, 1)] },
    { i: 2, boxes: [box(50, 120, 1)] },
  ];
  assert.deepEqual(D.dropTarget(parts, 0, 85 + 50, 9), { mode: 'swap', to: 1, line: null }, 'middle of part 1 = swap');
  assert.equal(D.dropTarget(parts, 0, 25, 25 + 0).mode, 'swap', 'continuation line of a wrapped part is that part');
  assert.equal(D.dropTarget(parts, 0, 25, 25).to, 1);
  const before2 = D.dropTarget(parts, 0, 52, 29);
  assert.deepEqual([before2.mode, before2.to], ['move', 2], 'leading edge of part 2 = move before it');
  const after2 = D.dropTarget(parts, 0, 118, 29);
  assert.deepEqual([after2.mode, after2.to], ['move', 3], 'trailing edge of the last part = move to the end');
  assert.equal(after2.line.x, 122);
  const leadWrapped = D.dropTarget(parts, 2, 72, 9);
  assert.deepEqual([leadWrapped.mode, leadWrapped.to], ['move', 1], 'leading edge of a wrapped part (its first line)');
  // Its continuation line has no leading zone: that is swap.
  assert.equal(D.dropTarget(parts, 2, 2, 29).mode, 'swap');
  assert.deepEqual(D.dropTarget(parts, 1, 120, 9), { mode: 'swap', to: -1, line: null }, 'on itself = nothing');
  assert.equal(D.dropTarget(parts, 1, 62, 9).to, -1, 'right next to itself = nothing');
  const gap = D.dropTarget(parts, 0, 300, 60);
  assert.deepEqual([gap.mode, gap.to], ['move', 3], 'below / past the end: nearest box → after it');
  assert.equal(D.dropTarget(parts, 2, -20, 9).to, 0, 'left of the first part = to the front');
});

test('d805039 follow-up: the part under the pointer lights up (thin move bands), at any UI zoom', () => {
  const D = load('src/screens/image/prompt/partDrag.ts');
  const box = (left, right, row, z = 1) => ({ left: left * z, right: right * z, top: row * 20 * z, bottom: (row * 20 + 18) * z });
  for (const z of [1, 1.1, 1.25]) {
    // A long part on one line: "Emphasize the dense texture of the bones" = [100, 400]
    const parts = [{ i: 0, boxes: [box(0, 90, 0, z)] }, { i: 1, boxes: [box(100, 400, 0, z)] }];
    // Pointer over "Emphasize the" (well inside the first quarter): it is the target to swap with.
    assert.deepEqual(D.dropTarget(parts, 0, 140 * z, 9 * z), { mode: 'swap', to: 1, line: null }, `zoom ${z}`);
    assert.equal(D.dropTarget(parts, 0, (100 + 4) * z, 9 * z).mode, 'move', 'only the very start is the move band');
  }
});

test('placeGrip: picks the spot covering the least text; stays in bounds', () => {
  const D = load('src/screens/image/prompt/partDrag.ts');
  const b = (left, right, top, bottom) => ({ left, right, top, bottom });
  const bounds = b(-12, 312, -8, 200);
  // Part starts a line: left of it is the box padding — free.
  let g = D.placeGrip(b(0, 80, 23, 41), b(0, 80, 23, 41), [b(0, 300, 0, 18), b(90, 300, 23, 41)], 20, 24, b(-24, 312, -8, 200));
  assert.equal(g.at, 'left', 'room in the padding: left of the part');
  g = D.placeGrip(b(0, 80, 23, 41), b(0, 80, 23, 41), [b(0, 300, 0, 18), b(90, 300, 23, 41)], 20, 24, bounds);
  assert.notEqual(g.at, 'left', 'no room on the left: somewhere else');
  // Part mid-line with text left of it and above it; free space after its end.
  g = D.placeGrip(b(120, 200, 23, 41), b(120, 200, 23, 41), [b(0, 110, 23, 41), b(0, 300, 0, 18)], 20, 24, bounds);
  assert.equal(g.at, 'after');
  // Nothing in bounds → the first candidate, never throws.
  g = D.placeGrip(b(0, 10, 0, 18), b(0, 10, 0, 18), [], 20, 24, b(0, 1, 0, 1));
  assert.equal(g.at, 'left');
});

test('no-op drags leave the text byte-identical; a swap back restores it', () => {
  const t = 'A colossal wyvern, (bones:1.2). Emphasize the dense texture\nlast';
  const parts = P.parseSections(t);
  for (let i = 0; i < parts.length; i++) {
    assert.equal(P.movePart(t, parts, i, i, 'swap'), null);
    assert.equal(P.movePart(t, parts, i, i, 'move'), null);
    assert.equal(P.movePart(t, parts, i, i + 1, 'move'), null);
  }
  const once = edit(t, P.movePart(t, parts, 0, 2, 'swap'));
  const back = edit(once, P.movePart(once, P.parseSections(once), 0, 2, 'swap'));
  assert.equal(back, t);
  assert.ok(!/w yvern/.test(once) && once.includes('A colossal wyvern'), 'words are never split');
  assert.equal([...once].sort().join(''), [...t].sort().join(''), 'same characters, only reordered');
});
