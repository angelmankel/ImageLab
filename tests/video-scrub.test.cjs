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
const { scrubTime, alongVideo, timeLabel } = load('videoScrub');

test('a full-width drag covers the whole clip, clamped at both ends', () => {
  assert.equal(scrubTime(0, 390, 390, 5), 5);
  assert.equal(scrubTime(2.5, -39, 390, 5), 2);
  assert.equal(scrubTime(1, -1000, 390, 5), 0);
  assert.equal(scrubTime(4, 1000, 390, 5), 5);
  assert.equal(scrubTime(1, 50, 390, NaN), 1);
});

test('turned with CSS, the video runs down the screen', () => {
  assert.equal(alongVideo(10, 40, false), 10);
  assert.equal(alongVideo(10, 40, true), 40);
  assert.equal(timeLabel(1.254, 5.0625), '1.25 / 5.06 s');
});
