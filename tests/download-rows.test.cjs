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
const lib = load('downloadRows');

test('the origin is the host without its path', () => {
  assert.equal(lib.hostOrigin('pod:8188/video-comfy'), 'pod:8188');
  assert.equal(lib.hostOrigin('pod:8188/video-comfy/'), 'pod:8188');
  assert.equal(lib.hostOrigin('Pod.example.com'), 'pod.example.com');
});

test('a pod with an image and a video server is polled once; other boxes stay', () => {
  const servers = [
    { id: 'a', host: 'pod:8188' },
    { id: 'b', host: 'pod:8188/video-comfy' },
    { id: 'c', host: '192.168.0.83:8188' },
  ];
  assert.deepEqual(lib.onePerOrigin(servers).map((s) => s.id), ['a', 'c']);
  assert.deepEqual(lib.onePerOrigin([]), []);
});
