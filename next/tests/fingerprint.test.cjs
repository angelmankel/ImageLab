const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/app/fingerprintLogic.ts');

test('flatten: sorted paths, long strings hashed, LoRAs keyed by name', () => {
  const snap = L.flatten({ cfg: 4.5, prompt: { positive: 'x'.repeat(100) }, loras: [{ id: 'a', name: 'detail.safetensors', weight: 0.8 }], skip: undefined, f: () => 1 });
  assert.equal(snap.cfg, '4.5');
  assert.match(snap['prompt.positive'], /^#/);
  assert.equal(snap['loras[detail.safetensors].weight'], '0.8');
  assert.equal('skip' in snap, false);
  assert.equal('f' in snap, false);
});

test('fingerprint: key order does not matter, a value does', () => {
  const a = L.fingerprintOf({ cfg: '4', steps: '20' });
  assert.equal(a, L.fingerprintOf({ steps: '20', cfg: '4' }));
  assert.notEqual(a, L.fingerprintOf({ steps: '20', cfg: '5' }));
  // LoRA order is not a change
  const x = L.flatten({ loras: [{ name: 'a', weight: 1 }, { name: 'b', weight: 1 }] });
  const y = L.flatten({ loras: [{ name: 'b', weight: 1 }, { name: 'a', weight: 1 }] });
  assert.equal(L.fingerprintOf(x), L.fingerprintOf(y));
});

test('diff: readable lines, capped', () => {
  assert.deepEqual(L.diffSnaps({ cfg: '4.5' }, { cfg: '6' }), ['CFG 4.5 → 6']);
  assert.deepEqual(L.diffSnaps({ 'prompt.positive': '#a' }, { 'prompt.positive': '#b' }), ['Prompt edited']);
  assert.deepEqual(L.diffSnaps({}, { 'loras[detail.safetensors].weight': '1', 'loras[detail.safetensors].on': 'true' }), ['LoRA detail added']);
  assert.deepEqual(L.diffSnaps({ input: 'u1' }, { input: 'u2' }), ['New input picture']);
  assert.deepEqual(L.diffSnaps({ 'refine.denoise': '0.5' }, { 'refine.denoise': '0.4' }), ['Denoise 0.5 → 0.4']);
  const many = L.diffSnaps({ a: '1', b: '1', c: '1', d: '1', e: '1' }, { a: '2', b: '2', c: '2', d: '2', e: '2' });
  assert.equal(many.length, 4);
  assert.equal(many[3], '+ 2 more');
});

test('withSeedsFrom: seeds from now, the rest as sent', () => {
  assert.deepEqual(L.withSeedsFrom({ seed: '1', cfg: '4' }, { seed: '2', cfg: '9' }), { seed: '2', cfg: '4' });
});

test('chain: none / fresh / stale, stale spreads to followers only', () => {
  const f = (id, o) => ({ id, hasOutput: true, nowFp: 'x', outFp: 'x', followsAbove: true, ...o });
  const r = L.chainFreshness([f('a', { nowFp: 'y' }), f('b'), f('c', { followsAbove: false }), f('d'), f('e', { hasOutput: false })]);
  assert.deepEqual(r.map((x) => x.state), ['stale', 'stale', 'fresh', 'fresh', 'none']);
  assert.deepEqual(r.map((x) => x.reason), ['own', 'above', null, null, null]);
  // unknown fingerprint (an old output) counts as up to date
  assert.equal(L.chainFreshness([f('a', { outFp: undefined, nowFp: 'z' })])[0].state, 'fresh');
});

test('style references are part of the image step fingerprint, with readable labels (Style tab)', () => {
  const load = require('./_load.cjs');
  const F = load('src/app/fingerprintLogic.ts');
  const ref = { id: 'a', type: 'style', on: true, weight: 1, start: 0, end: 1, images: [{ key: 'k1', name: 'a.png', width: 9, height: 9, thumb: 'data:image/jpeg;base64,' + 'x'.repeat(80) }] };
  const a = F.flatten({ cfg: 5 });
  const b = F.flatten({ cfg: 5, styleRefs: [ref] });
  const c = F.flatten({ cfg: 5, styleRefs: [{ ...ref, weight: 0.8 }] });
  assert.equal(F.fingerprintOf(a), F.fingerprintOf(F.flatten({ cfg: 5, styleRefs: [] })));
  assert.notEqual(F.fingerprintOf(a), F.fingerprintOf(b));
  assert.notEqual(F.fingerprintOf(b), F.fingerprintOf(c));
  assert.equal(F.labelOf('styleRefs.0.weight'), 'Style reference 1 strength');
  assert.equal(F.labelOf('styleRefs.1.images.0.key'), 'Style reference 2 picture');
});
