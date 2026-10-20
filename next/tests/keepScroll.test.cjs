// useKeepScroll's pure parts: the models list key (one spot per source · kind · search, phone apart)
// and the "can the saved spot be reached yet" check behind the lazy-list restore.
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const { modelsListKey, reachable, keptScroll } = load('src/screens/models/useKeepScroll.ts');

test('modelsListKey: source, kind (all when none), trimmed query', () => {
  assert.equal(modelsListKey('installed', 'lora', ''), 'models:installed:lora:');
  assert.equal(modelsListKey('civitai', null, '  anime  '), 'models:civitai:all:anime');
  assert.equal(modelsListKey('civitai', undefined, 'x'), 'models:civitai:all:x');
});

test('modelsListKey: the phone list keeps its own spot', () => {
  assert.equal(modelsListKey('installed', 'lora', 'a', true), 'phone:models:installed:lora:a');
  assert.notEqual(modelsListKey('installed', 'lora', 'a', true), modelsListKey('installed', 'lora', 'a'));
});

test('modelsListKey: a different filter set is a different list', () => {
  const keys = new Set([
    modelsListKey('installed', 'lora', ''), modelsListKey('civitai', 'checkpoint', ''),
    modelsListKey('civitai', 'lora', ''), modelsListKey('installed', 'lora', 'q'),
  ]);
  assert.equal(keys.size, 4);
});

test('reachable: within the scroll range (1px slack), else wait for more rows', () => {
  assert.equal(reachable({ top: 500, left: 0 }, { top: 800, left: 0 }), true);
  assert.equal(reachable({ top: 801, left: 0 }, { top: 800, left: 0 }), true);
  assert.equal(reachable({ top: 1200, left: 0 }, { top: 800, left: 0 }), false);
  assert.equal(reachable({ top: 0, left: 300 }, { top: 0, left: 120 }), false);
  assert.equal(reachable({ top: 0, left: 0 }, { top: 0, left: 0 }), true);
});

test('keptScroll: nothing kept for a null key or an unseen one', () => {
  assert.equal(keptScroll(null), undefined);
  assert.equal(keptScroll('detail:1'), undefined);
});
