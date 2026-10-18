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
const { ggufQuant, ggufChoices, hfPullName, vramFit, parsePullLine, modelLabel, stripThinking } = load('llmModels');

const GB = 2 ** 30;

test('quant labels from file names', () => {
  assert.equal(ggufQuant('mlabonne_gemma-3-12b-it-abliterated-Q4_K_M.gguf'), 'Q4_K_M');
  assert.equal(ggufQuant('gemma-3-12b-it-abliterated-v2.q6_k.gguf'), 'Q6_K');
  assert.equal(ggufQuant('Qwen3-8B-abliterated.Q8_0.gguf'), 'Q8_0');
  assert.equal(ggufQuant('model-IQ4_XS.gguf'), 'IQ4_XS');
  assert.equal(ggufQuant('sub/dir/model-UD-Q3_K_XL-00001-of-00002.gguf'), 'Q3_K_XL');
  assert.equal(ggufQuant('model-BF16.gguf'), 'BF16');
  assert.equal(ggufQuant('qwen3-8b.gguf'), null);
});

test('choices: projectors skipped, split files summed, smallest first', () => {
  const choices = ggufChoices([
    { path: 'README.md', size: 10 },
    { path: 'm-Q8_0.gguf', size: 12 * GB, type: 'file' },
    { path: 'm-Q4_K_M.gguf', size: 7 * GB },
    { path: 'mmproj-m-f16.gguf', size: 1 * GB },
    { path: 'big/m-Q6_K-00001-of-00002.gguf', size: 5 * GB },
    { path: 'big/m-Q6_K-00002-of-00002.gguf', size: 4 * GB },
    { path: 'Q8_0', type: 'directory' },
  ]);
  assert.equal(choices.map((c) => c.quant).join(), 'Q4_K_M,Q6_K,Q8_0');
  assert.equal(choices[1].bytes, 9 * GB);
  assert.equal(choices[1].files.length, 2);
});

test('pull name and VRAM fit', () => {
  assert.equal(hfPullName('bartowski/x-GGUF', 'Q6_K'), 'hf.co/bartowski/x-GGUF:Q6_K');
  assert.equal(vramFit(9 * GB, 20), 'fits');
  assert.equal(vramFit(17 * GB, 20), 'tight');
  assert.equal(vramFit(24 * GB, 20), 'too-big');
});

test('pull stream lines', () => {
  const p = parsePullLine('{"status":"pulling abc","total":10,"completed":4}');
  assert.deepEqual([p.status, p.total, p.completed], ['pulling abc', 10, 4]);
  assert.equal(parsePullLine('{"status":"pul'), null);
  assert.equal(parsePullLine('  '), null);
});

test('labels and thinking', () => {
  assert.equal(modelLabel('hf.co/bartowski/mlabonne_gemma-3-12b-it-abliterated-GGUF:Q6_K'), 'mlabonne_gemma-3-12b-it-abliterated · Q6_K');
  assert.equal(modelLabel('huihui_ai/qwen3-abliterated:8b-v2-q8_0'), 'qwen3-abliterated · 8b-v2-q8_0');
  assert.equal(modelLabel('gemma3:latest'), 'gemma3');
  assert.equal(stripThinking('<think>hmm\nok</think>\nmasterpiece, best quality'), 'masterpiece, best quality');
  assert.equal(stripThinking('<think>cut off mid-thought'), '');
});
