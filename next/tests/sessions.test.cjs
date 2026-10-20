const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/app/sessionsLogic.ts');
const { nanoid } = require('./_load.cjs')('src/app/ids.ts');

const steps = [
  { id: 'a', kind: 'image', name: 'Portrait · SDXL', edited: true, chained: false },
  { id: 'b', kind: 'upscale', name: 'Upscale', edited: false, chained: true, chainMode: 'pick', chainPick: { key: 'k1', url: 'u', name: 'n' } },
  { id: 'c', kind: 'video', name: 'Video', edited: false, chained: false, input: { url: 'x', name: 'x.png' } },
];

test('nanoid: 21 url-safe chars, unique', () => {
  const a = nanoid(), b = nanoid();
  assert.match(a, /^[A-Za-z0-9_-]{21}$/);
  assert.notEqual(a, b);
  assert.equal(nanoid(8).length, 8);
});

test('display name: blank → placeholder', () => {
  assert.equal(L.displayName(''), 'Untitled session');
  assert.equal(L.displayName('  '), 'Untitled session');
  assert.equal(L.displayName(undefined), 'Untitled session');
  assert.equal(L.displayName('Cats'), 'Cats');
});

test('new session: one Image step, blank name', () => {
  const s = L.makeSession('S', 'st', 5);
  assert.equal(s.name, '');
  assert.deepEqual(s.steps.map((x) => x.kind), ['image']);
  assert.equal(s.activeId, 'st');
});

test('migrate the single-session save; the old default names read as blank', () => {
  const s = L.migrateLegacy({ steps, activeId: 'c', sessionName: 'Portrait session' }, 'S', 'f', 1);
  assert.equal(s.name, '');
  assert.equal(s.legacy, true);
  assert.equal(s.activeId, 'c');
  assert.equal(s.steps.length, 3);
  const named = L.migrateLegacy({ steps, activeId: 'zz', sessionName: 'Cats' }, 'S', 'f', 1);
  assert.equal(named.name, 'Cats');
  assert.equal(named.activeId, 'a');
  const empty = L.migrateLegacy(null, 'S', 'f', 1);
  assert.equal(empty.steps[0].id, 'f');
  const noImage = L.migrateLegacy({ steps: [steps[1]], activeId: 'b' }, 'S', 'f', 1);
  assert.deepEqual(noImage.steps.map((x) => x.id), ['f', 'b']);
});

test('duplicate: fresh ids, same stack, map of old → new', () => {
  let n = 0;
  const src = { id: 'S', name: 'Cats', steps, activeId: 'b', createdAt: 1, updatedAt: 1, image: { workflow: { seed: 1 }, layers: [{ id: 'l' }] }, video: { fps: 16 }, legacy: true };
  const { session, map } = L.duplicateSession(src, 'T', () => `n${++n}`, 9);
  assert.deepEqual(session.steps.map((x) => x.id), ['n1', 'n2', 'n3']);
  assert.equal(map.a, 'n1');
  assert.equal(session.activeId, 'n2');
  assert.equal(session.steps[1].chainPick.key, 'k1');
  assert.notEqual(session.steps[1].chainPick, steps[1].chainPick);
  assert.equal(session.steps[2].input.url, 'x');
  assert.equal(session.legacy, false);
  assert.equal(session.createdAt, 9);
  assert.deepEqual(session.image.workflow, { seed: 1 });
  assert.notEqual(session.image.layers, src.image.layers);
  assert.equal(session.video.fps, 16);
});

test('tabs: move, insert after the current, close (never the last)', () => {
  assert.deepEqual(L.moveTab(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(L.moveTab(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(L.moveTab(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c']);
  assert.deepEqual(L.moveTab(['a', 'b', 'c'], 5, 0), ['a', 'b', 'c']);
  assert.deepEqual(L.insertTabAfter(['a', 'b', 'c'], 'a', 'x'), ['a', 'x', 'b', 'c']);
  assert.deepEqual(L.insertTabAfter(['a', 'b'], 'zz', 'x'), ['a', 'b', 'x']);
  assert.deepEqual(L.insertTabAfter(['a', 'b'], 'a', 'b'), ['a', 'b']);
  assert.equal(L.closeTab(['a'], 'a', 'a'), null);
  assert.equal(L.closeTab(['a', 'b'], 'a', 'zz'), null);
  assert.deepEqual(L.closeTab(['a', 'b', 'c'], 'b', 'b'), { openIds: ['a', 'c'], currentId: 'c' });
  assert.deepEqual(L.closeTab(['a', 'b', 'c'], 'c', 'c'), { openIds: ['a', 'b'], currentId: 'b' });
  assert.deepEqual(L.closeTab(['a', 'b', 'c'], 'a', 'c'), { openIds: ['a', 'b'], currentId: 'a' });
});

test('last output: newest result of the session’s steps; legacy owns untagged ones', () => {
  const results = [
    { key: 'r1', url: '1', kind: 'image', createdAt: 10 },
    { key: 'r2', url: '2', kind: 'image', createdAt: 20 },
    { key: 'r3', url: '3', kind: 'video', createdAt: 30 },
  ];
  const tags = { r1: 'a', r2: 'zz' };
  assert.equal(L.lastOutputOf({ steps, legacy: false }, tags, results).key, 'r1');
  assert.equal(L.lastOutputOf({ steps, legacy: true }, tags, results).key, 'r3');
  assert.equal(L.lastOutputOf({ steps: [{ id: 'q' }], legacy: false }, tags, results), null);
});

test('recent order and ago', () => {
  const a = { id: 'a', updatedAt: 1 }, b = { id: 'b', updatedAt: 5 };
  assert.deepEqual(L.byRecent([a, b]).map((s) => s.id), ['b', 'a']);
  assert.equal(L.ago(1000, 1000 + 30_000), 'just now');
  assert.equal(L.ago(0, 5 * 60_000), '5 min ago');
  assert.equal(L.ago(0, 3 * 3_600_000), '3 h ago');
  assert.equal(L.ago(0, 2 * 86_400_000), '2 d ago');
  assert.equal(L.ago(0, 70 * 86_400_000), '2 mo ago');
});
