// The phone map (mobile pass, m-shell): src/phone/nav/navLogic.ts (stack of layers, siblings, route
// screens) and hudLogic.ts (the HUD ring's two arcs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const N = load('src/phone/nav/navLogic.ts');
const H = load('src/phone/nav/hudLogic.ts');

const root = N.ROOT_PAGE;
const page = (kind, params) => ({ key: `${kind}-${JSON.stringify(params ?? {})}`, kind, params });

test('push adds a layer; pushing a page already in the stack goes back to it', () => {
  const s1 = N.pushPage([root], page('session', { id: 'a' }));
  assert.equal(s1.length, 2);
  const s2 = N.pushPage(s1, page('step', { id: 's1' }));
  assert.equal(s2.length, 3);
  const back = N.pushPage(s2, { key: 'x', kind: 'session', params: { id: 'a' } });
  assert.equal(back.length, 2);
  assert.equal(back[1].key, s1[1].key);
});

test('pop never removes the root; popToKey cuts above a layer', () => {
  const s = [root, page('a'), page('b')];
  assert.equal(N.popPages(s, 1).length, 2);
  assert.equal(N.popPages(s, 9).length, 1);
  assert.equal(N.popToKey(s, s[1].key).length, 2);
  assert.equal(N.popToKey(s, 'nope'), s);
});

test('transitionOf: push, pop, replace, none', () => {
  const a = [root]; const b = [root, page('x')]; const c = [root, page('y')];
  assert.equal(N.transitionOf(a, b), 'push');
  assert.equal(N.transitionOf(b, a), 'pop');
  assert.equal(N.transitionOf(b, c), 'replace');
  assert.equal(N.transitionOf(b, b), 'none');
});

test('stackForScreen: stays, goes back, follows a path, or pushes the place', () => {
  const screenOf = (k) => ({ home: 'home', library: 'library', session: 'step', step: 'step' })[k] ?? 'step';
  const paths = (s) => (s === 'step' ? [{ kind: 'home' }, { kind: 'session', params: { id: 'a' } }, { kind: 'step' }] : s === 'home' ? [{ kind: 'home' }] : null);
  const deep = [root, page('session', { id: 'a' }), page('step')];
  assert.equal(N.stackForScreen(deep, 'step', screenOf, paths), deep);
  const withLib = N.stackForScreen(deep, 'library', screenOf, paths);
  assert.deepEqual(withLib.map((p) => p.kind), ['home', 'session', 'step', 'library']);
  assert.deepEqual(N.stackForScreen(withLib, 'step', screenOf, paths).map((p) => p.kind), ['home', 'session', 'step']);
  const fromHome = N.stackForScreen([root], 'step', screenOf, paths);
  assert.deepEqual(fromHome.map((p) => p.kind), ['home', 'session', 'step']);
  assert.equal(fromHome[0], root);
  assert.equal(N.stackForScreen(deep, 'home', screenOf, paths).length, 1);
});

test('stackFromPath keeps the layers (and their keys) where the path agrees', () => {
  const s = [root, page('session', { id: 'a' }), page('step', { id: 1 })];
  const next = N.stackFromPath(s, [{ kind: 'home' }, { kind: 'session', params: { id: 'a' } }, { kind: 'step', params: { id: 2 } }]);
  assert.equal(next[1], s[1]);
  assert.notEqual(next[2].key, s[2].key);
  assert.equal(N.stackFromPath(s, [{ kind: 'home' }])[0], root);
});

test('siblings: a swipe moves one along, nothing past the ends; replaceAt swaps one layer', () => {
  assert.equal(N.siblingForSwipe(1, 3, -1), 2);
  assert.equal(N.siblingForSwipe(1, 3, 1), 0);
  assert.equal(N.siblingForSwipe(0, 3, 1), null);
  assert.equal(N.siblingForSwipe(2, 3, -1), null);
  const s = [root, page('a'), page('b')];
  assert.deepEqual(N.replaceAt(s, 1, page('c')).map((p) => p.kind), ['home', 'c']);
  assert.deepEqual(N.addressOf(s, (p) => (p.kind === 'b' ? 4 : 0)), [0, 0, 4]);
});

test('visiblePages: a pair in landscape only when both layers allow it', () => {
  const s = [root, page('session'), page('step')];
  assert.equal(N.visiblePages(s, true, () => true).left.kind, 'session');
  assert.equal(N.visiblePages(s, false, () => true).left, null);
  assert.equal(N.visiblePages(s, true, (k) => k !== 'step').left, null);
  assert.equal(N.visiblePages([root], true, () => true).left, null);
});

test('HUD ring: 4 inner + 6 outer targets, all on screen, 52 px apart at least', () => {
  for (const [w, h, land] of [[390, 844, false], [360, 740, false], [844, 390, true], [740, 360, true]]) {
    const cx = land ? w - 44 : w / 2; const cy = land ? h / 2 : h - 60;
    const lay = H.ringLayout(4, 6, cx, cy, w, h, land);
    const all = [...lay.inner, ...lay.outer];
    assert.equal(all.length, 10);
    for (const p of all) {
      assert.ok(cx + p.x >= H.RING_ITEM / 2 && cx + p.x <= w - H.RING_ITEM / 2, `x in ${w}x${h}`);
      assert.ok(cy + p.y >= H.RING_ITEM / 2 && cy + p.y <= h - H.RING_ITEM / 2 + 30, `y in ${w}x${h}`);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) >= H.RING_ITEM, `spacing ${i},${j} in ${w}x${h}`);
    }
  }
});

test('HUD ring hit test picks the nearest target under the finger', () => {
  const spots = [{ x: 0, y: -90 }, { x: 60, y: -60 }];
  assert.equal(H.ringHit(spots, 2, -88), 0);
  assert.equal(H.ringHit(spots, 58, -62), 1);
  assert.equal(H.ringHit(spots, 200, 200), -1);
});
