const test = require('node:test');
const assert = require('node:assert');
// Pure helpers are re-implemented here until the app's TS is compiled for tests; keep in sync with src/app/routeStore.ts.
const SCREENS = ['step', 'library', 'models', 'comfy', 'settings'];
const screenOfHash = (h) => { const seg = h.replace(/^#\/?/, '').split(/[/?]/)[0]; return SCREENS.includes(seg) ? seg : 'step'; };
test('hash → screen', () => {
  assert.equal(screenOfHash(''), 'step');
  assert.equal(screenOfHash('#/'), 'step');
  assert.equal(screenOfHash('#/library'), 'library');
  assert.equal(screenOfHash('#/models?x=1'), 'models');
  assert.equal(screenOfHash('#/nope'), 'step');
});
