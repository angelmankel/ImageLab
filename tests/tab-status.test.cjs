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
  vm.runInNewContext(code, { exports, encodeURIComponent });
  return exports;
}
const raw = load('tabStatus');
// Objects made inside the vm have its prototypes; copy them out so deepEqual compares values.
const plain = v => JSON.parse(JSON.stringify(v));
const lib = { ...raw, tabState: (...a) => plain(raw.tabState(...a)) };
const idle = { busy: false, running: false, percent: null };
const queued = { busy: true, running: false, percent: null };
const run = p => ({ busy: true, running: true, percent: p });

test('running beats queued beats a flash beats idle', () => {
  assert.deepEqual(lib.tabState([idle, idle], null), { kind: 'idle', percent: null });
  assert.equal(lib.tabState([idle, idle], 'done').kind, 'done');
  assert.equal(lib.tabState([queued, idle], 'error').kind, 'queued');
  assert.deepEqual(lib.tabState([queued, run(41.6)], 'done'), { kind: 'running', percent: 42 });
});

test('the percent comes from a running source that has one, clamped', () => {
  assert.equal(lib.tabState([run(null), run(130)], null).percent, 100);
  assert.equal(lib.tabState([run(null)], null).percent, null);
});

test('titles', () => {
  assert.equal(lib.tabTitle({ kind: 'running', percent: 7 }, 'ImageLab'), '▶ 7% · ImageLab');
  assert.equal(lib.tabTitle({ kind: 'running', percent: null }, 'ImageLab'), '▶ ImageLab');
  assert.equal(lib.tabTitle({ kind: 'queued', percent: null }, 'ImageLab'), '… ImageLab');
  assert.equal(lib.tabTitle({ kind: 'done', percent: null }, 'ImageLab'), '✓ Done · ImageLab');
  assert.equal(lib.tabTitle({ kind: 'error', percent: null }, 'ImageLab'), '✕ Error · ImageLab');
  assert.equal(lib.tabTitle({ kind: 'idle', percent: null }, 'ImageLab'), 'ImageLab');
});

test('the icon has a ring only while work is waiting or running', () => {
  assert.ok(!lib.tabIconSvg({ kind: 'done', percent: null }).includes('<circle'));
  assert.ok(lib.tabIconSvg({ kind: 'queued', percent: null }).includes('<circle'));
  const half = lib.tabIconSvg({ kind: 'running', percent: 50 });
  assert.equal((half.match(/<circle/g) || []).length, 2);
  assert.ok(lib.tabIconHref({ kind: 'error', percent: null }).startsWith('data:image/svg+xml,'));
});
