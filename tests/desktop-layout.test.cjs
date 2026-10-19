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
  vm.runInNewContext(code, { exports, Math, Number });
  return exports;
}
const d = load('desktopLayout');

test('folded ids are cleaned to known ones without repeats', () => {
  assert.deepEqual([...d.cleanFolded(['models', 'nope', 'models', 3, 'size'], ['mode', 'models', 'size'])], ['models', 'size']);
  assert.deepEqual([...d.cleanFolded('models', ['models'])], []);
  assert.deepEqual([...d.cleanFolded(null, ['models'])], []);
});

test('toggle folds and unfolds; unfold never folds', () => {
  assert.deepEqual([...d.toggleFolded([], 'a')], ['a']);
  assert.deepEqual([...d.toggleFolded(['a', 'b'], 'a')], ['b']);
  assert.deepEqual([...d.unfold(['a', 'b'], 'a')], ['b']);
  assert.deepEqual([...d.unfold(['b'], 'a')], ['b']);
});

test('Alt+N picks the Nth card on screen', () => {
  assert.equal(d.nthSection(['p', 'm', 'c'], 1), 'p');
  assert.equal(d.nthSection(['p', 'm', 'c'], 3), 'c');
  assert.equal(d.nthSection(['p', 'm', 'c'], 4), null);
  assert.equal(d.nthSection(['p'], 0), null);
});

test('arrows step through a newest-first list and clamp', () => {
  assert.equal(d.stepResult(0, 5, 1), 1);   // left: older
  assert.equal(d.stepResult(1, 5, -1), 0);  // right: newer
  assert.equal(d.stepResult(0, 5, -1), 0);
  assert.equal(d.stepResult(4, 5, 1), 4);
  assert.equal(d.stepResult(-1, 5, 1), 1);  // nothing picked: from the newest
  assert.equal(d.stepResult(9, 5, 1), 4);   // stale index past the end
  assert.equal(d.stepResult(0, 0, 1), -1);
});

test('the strip size stays within its limits', () => {
  assert.equal(d.clampStrip(undefined), d.STRIP_LIMITS.default);
  assert.equal(d.clampStrip(10), d.STRIP_LIMITS.min);
  assert.equal(d.clampStrip(999), d.STRIP_LIMITS.max);
  assert.equal(d.clampStrip(120.4), 120);
  assert.equal(d.clampStrip(NaN), d.STRIP_LIMITS.default);
});

test('video starts with Models folded, the others open', () => {
  assert.deepEqual([...d.DEFAULT_FOLDED.video], ['models']);
  assert.deepEqual([...d.DEFAULT_FOLDED.image], []);
  assert.equal(d.OLD_VIDEO_FOLDED_KEY, 'imagelab.video.folded.v1');
});
