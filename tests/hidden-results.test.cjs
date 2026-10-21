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
const h = load('hiddenResults');
const r = (url) => ({ url, filename: url + '.mp4' });
/** The module runs in its own realm: copy its arrays into this one before comparing. */
const urls = (list) => [...list].map((x) => x.url);

test('hiding adds the url once, newest last, capped oldest-first', () => {
  assert.deepEqual([...h.hideUrl([], 'a')], ['a']);
  assert.deepEqual([...h.hideUrl(['a', 'b'], 'a')], ['b', 'a']);
  assert.deepEqual([...h.hideUrl(['a', 'b', 'c'], 'd', 3)], ['b', 'c', 'd']);
});

test('un-hiding takes the url out', () => {
  assert.deepEqual([...h.unhideUrl(['a', 'b'], 'a')], ['b']);
  assert.deepEqual([...h.unhideUrl(['a'], 'z')], ['a']);
});

test('hidden results are left out; same array when none are hidden', () => {
  const list = [r('a'), r('b'), r('c')];
  assert.deepEqual(urls(h.withoutHidden(list, ['b'])), ['a', 'c']);
  assert.equal(h.withoutHidden(list, []), list);
  assert.equal(h.withoutHidden(list, ['z']), list);
});

test('Undo puts a result back at its index, clamped, never twice', () => {
  const list = [r('a'), r('c')];
  assert.deepEqual(urls(h.insertResult(list, 1, r('b'))), ['a', 'b', 'c']);
  assert.deepEqual(urls(h.insertResult(list, 99, r('d'))), ['a', 'c', 'd']);
  assert.deepEqual(urls(h.insertResult(list, -3, r('z'))), ['z', 'a', 'c']);
  assert.equal(h.insertResult(list, 0, r('a')), list);
});

test('a saved list reads back as strings only, capped; junk is empty', () => {
  assert.deepEqual([...h.parseHidden(JSON.stringify(['a', 1, 'b', null]))], ['a', 'b']);
  assert.deepEqual([...h.parseHidden(JSON.stringify(['a', 'b', 'c']), 2)], ['b', 'c']);
  assert.deepEqual([...h.parseHidden(null)], []);
  assert.deepEqual([...h.parseHidden('{oops')], []);
  assert.deepEqual([...h.parseHidden('{"a":1}')], []);
});

test('a view url hides by its file, whatever host or path built it', () => {
  const a = 'https://pod.example/comfy/view?filename=ImageLab_00012_.png&subfolder=&type=output';
  const b = 'http://192.168.0.83:8188/view?filename=ImageLab_00012_.png&subfolder=&type=output';
  assert.equal(h.resultFileKey(a), h.resultFileKey(b));
  assert.equal(h.resultFileKey(a), 'file:ImageLab_00012_.png||output');
  assert.equal(h.resultFileKey('http://x/view?filename=a+b.png&subfolder=video&type=temp'), 'file:a b.png|video|temp');
  assert.equal(h.resultFileKey('blob:abc'), 'blob:abc');
  assert.deepEqual(urls(h.withoutHidden([{ url: b }, r('c')], [a])), ['c']);
  assert.deepEqual([...h.unhideUrl([a], b)], []);
  assert.deepEqual([...h.hideUrl([a], b)], [b]);
});
