const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, fetch: () => { throw new Error('no fetch in tests'); } });
  return exports;
}
const lib = load('veniceModels');

test('parses Venice text models: offline and non-text dropped, uncensored first', () => {
  const list = lib.parseVeniceModels({ data: [
    { id: 'zeta', type: 'text', model_spec: { name: 'Zeta', capabilities: { supportsVision: true }, pricing: { input: { usd: 0.5 } } } },
    { id: 'venice-uncensored-1-2', type: 'text', model_spec: { name: 'Venice Uncensored 1.2', traits: ['most_uncensored'] } },
    { id: 'gone', type: 'text', model_spec: { name: 'Gone', offline: true } },
    { id: 'img', type: 'image', model_spec: { name: 'Image' } },
    { id: 'alpha', type: 'text' },
    { type: 'text' },
  ] });
  assert.deepEqual([...list.map(m => m.id)], ['venice-uncensored-1-2', 'alpha', 'zeta']);
  assert.equal(list[2].vision, true);
  assert.equal(list[2].price, 0.5);
  assert.equal(list[1].name, 'alpha');
  assert.equal(lib.veniceModelLabel(list[2]), 'Zeta · vision · $0.5/M');
  assert.equal(lib.parseVeniceModels(null).length, 0);
});
