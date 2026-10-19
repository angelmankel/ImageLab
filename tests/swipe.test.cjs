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
  vm.runInNewContext(code, { exports, Math });
  return exports;
}
const s = load('swipe');

test('a swipe locks sideways only when clearly sideways and the right way', () => {
  assert.equal(s.swipeAxis(4, 2, 1), null);
  assert.equal(s.swipeAxis(30, 5, 1), 'x');
  assert.equal(s.swipeAxis(30, 25, 1), 'y'); // slanted: a scroll
  assert.equal(s.swipeAxis(-30, 5, 1), 'y'); // the wrong way
  assert.equal(s.swipeAxis(-30, 5, -1), 'x');
});

test('release goes back past a third of the width or on a flick', () => {
  assert.ok(s.swipeCommits(140, 600, 390, 1));
  assert.ok(!s.swipeCommits(100, 600, 390, 1));
  assert.ok(s.swipeCommits(60, 80, 390, 1)); // quick flick
  assert.ok(!s.swipeCommits(30, 20, 390, 1)); // too short even if quick
  assert.ok(!s.swipeCommits(-200, 100, 390, 1));
  assert.ok(s.swipeCommits(-200, 600, 390, -1));
  assert.equal(s.swipeOffset(-20, 1), 0);
  assert.equal(s.swipeOffset(20, -1), 0);
});
