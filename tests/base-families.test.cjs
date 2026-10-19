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
  vm.runInNewContext(code, { exports });
  return exports;
}
const lib = load('baseFamilies');
const fam = id => lib.BASE_FAMILIES.find(f => f.id === id);

test('labels group into their family, unknown ones stay themselves', () => {
  assert.equal(lib.baseGroupOf('Wan Video 2.2 I2V-A14B'), 'Wan');
  assert.equal(lib.baseGroupOf('Wan Video 9 T2V'), 'Wan'); // not listed, caught by the pattern
  assert.equal(lib.baseGroupOf('Pony V7'), 'Pony');
  assert.equal(lib.baseGroupOf('Illustrious'), 'Illustrious');
  assert.equal(lib.baseGroupOf('SDXL Lightning'), 'SDXL');
  assert.equal(lib.baseGroupOf('SD 1.5 LCM'), 'SD 1.5');
  assert.equal(lib.baseGroupOf('SD 3.5'), 'SD 3');
  assert.equal(lib.baseGroupOf('Kolors'), 'Kolors');
  assert.equal(lib.baseGroupOf(''), '');
});

test('a family toggles all of its labels and keeps other picks', () => {
  const wan = fam('wan');
  const on = lib.toggleFamily(['Pony', 'Wan Video 14B t2v'], wan);
  assert.equal(on[0], 'Pony');
  assert.ok(lib.familyPicked(on, wan));
  assert.equal(new Set(on).size, on.length);
  assert.deepEqual([...lib.toggleFamily(on, wan)], ['Pony']);
  assert.ok(!lib.familyPicked(['Wan Video 14B t2v'], wan));
});
