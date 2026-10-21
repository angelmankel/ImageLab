const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./_load.cjs')('src/app/sessionColor.ts');

test('pickColor: first unused, then least used', () => {
  assert.equal(C.pickColor([]), 'ember');
  assert.equal(C.pickColor(['ember', 'sky']), 'mint');
  const all = C.SESSION_COLORS.map((c) => c.id);
  assert.equal(C.pickColor(all), 'ember');
  assert.equal(C.pickColor([...all, 'ember']), 'sky');
});

test('colorOf: stored colour wins; old sessions get a stable one from the id', () => {
  assert.equal(C.colorOf({ id: 'x', color: 'mint' }), '#3DD6A0');
  assert.equal(C.colorOf({ id: 'abc' }), C.colorOf({ id: 'abc' }));
  assert.ok(C.SESSION_COLORS.some((c) => c.hex === C.colorOf({ id: 'abc', color: 'nope' })));
  assert.equal(C.colorIdOf({ id: 'q', color: 'rose' }), 'rose');
});
