const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/screens/image/frame/frameLayers.ts');

const run = (actions) => actions.reduce((s, a) => L.frameReducer(s, a), []);

test('first picture is pending until decoded, then shown', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }]);
  assert.deepEqual(s, [{ id: 1, url: 'a', ready: false }]);
  s = L.frameReducer(s, { type: 'ready', id: 1 });
  assert.equal(L.topReady(s).url, 'a');
});

test('the old frame stays until the new one decoded, then settles away', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }, { type: 'ready', id: 1 }, { type: 'push', id: 2, url: 'b' }]);
  assert.equal(L.topReady(s).url, 'a');
  assert.equal(s.length, 2);
  s = L.frameReducer(s, { type: 'ready', id: 2 });
  assert.equal(L.topReady(s).url, 'b');
  assert.equal(s.length, 2, 'old stays under while the new fades in');
  s = L.frameReducer(s, { type: 'settle', id: 2 });
  assert.deepEqual(s.map((l) => l.url), ['b']);
});

test('frames faster than decode: only the newest pending one is kept besides the new one', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }, { type: 'ready', id: 1 }, { type: 'push', id: 2, url: 'b' }, { type: 'push', id: 3, url: 'c' }, { type: 'push', id: 4, url: 'd' }]);
  assert.deepEqual(s.map((l) => l.url), ['a', 'c', 'd']);
  s = L.frameReducer(s, { type: 'ready', id: 2 });
  assert.deepEqual(s.map((l) => l.url), ['a', 'c', 'd'], 'a dropped frame decoding late is ignored');
  s = L.frameReducer(s, { type: 'ready', id: 3 });
  assert.equal(L.topReady(s).url, 'c', 'whichever decodes first shows: no starvation');
  s = L.frameReducer(s, { type: 'ready', id: 4 });
  assert.equal(L.topReady(s).url, 'd');
  s = L.frameReducer(s, { type: 'ready', id: 3 });
  assert.equal(L.topReady(s).url, 'd');
});

test('a new frame mid-fade keeps the layer under the fading one', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }, { type: 'ready', id: 1 }, { type: 'push', id: 2, url: 'b' }, { type: 'ready', id: 2 }, { type: 'push', id: 3, url: 'c' }]);
  assert.deepEqual(s.map((l) => l.url), ['a', 'b', 'c']);
});

test('null clears; same url is a no-op; failed new frame keeps the old one', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }, { type: 'ready', id: 1 }]);
  assert.equal(L.frameReducer(s, { type: 'push', id: 2, url: 'a' }), s);
  s = L.frameReducer(s, { type: 'push', id: 2, url: 'b' });
  s = L.frameReducer(s, { type: 'fail', id: 2 });
  assert.deepEqual(s.map((l) => l.url), ['a']);
  assert.deepEqual(L.frameReducer(s, { type: 'push', id: 3, url: null }), []);
});

test('going back to the shown url while another is pending drops the pending one', () => {
  let s = run([{ type: 'push', id: 1, url: 'a' }, { type: 'ready', id: 1 }, { type: 'push', id: 2, url: 'b' }, { type: 'push', id: 3, url: 'a' }]);
  assert.deepEqual(s.map((l) => l.url), ['a']);
});

test('fadeMs: motion 0 is a cut, 1 is 150 ms', () => {
  assert.equal(L.fadeMs(0), 0);
  assert.equal(L.fadeMs(1), 150);
  assert.equal(L.fadeMs(NaN), 0);
});
