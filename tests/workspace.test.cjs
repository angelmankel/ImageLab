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
const w = load('workspace');

test('the old views are the modes', () => {
  assert.equal(w.modeOfView('generate'), 'image');
  assert.equal(w.modeOfView('video'), 'video');
  assert.equal(w.modeOfView('studio'), 'workflow');
  assert.equal(w.modeOfView('canvas'), null);
  assert.equal(w.viewOfMode('workflow'), 'studio');
  assert.ok(w.isWorkspaceView('video'));
  assert.ok(!w.isWorkspaceView('collections'));
});

test('simple shows the critical sections, advanced everything, in order', () => {
  const order = ['prompts', 'models', 'parameters', 'composition', 'enhancement', 'input', 'passes'];
  assert.deepEqual([...w.visibleSections(order, 'simple', w.sectionTier)], ['prompts', 'models', 'composition', 'input']);
  assert.deepEqual([...w.visibleSections(order, 'advanced', w.sectionTier)], order);
  const video = ['mode', 'prompt', 'models', 'loras', 'size', 'speed', 'upscale'];
  assert.deepEqual([...w.visibleSections(video, 'simple', w.videoSectionTier)], ['mode', 'prompt', 'size']);
});

test('recents are newest first, unique and capped', () => {
  assert.deepEqual([...w.pushRecent(['a', 'b'], 'b')], ['b', 'a']);
  assert.deepEqual([...w.pushRecent(['a', 'b'], 'c', 2)], ['c', 'a']);
});

test('chips: in the prompt, then recent, then the rest', () => {
  const all = ['q', 'r', 's', 't'].map(id => ({ id }));
  const out = w.chipOrder(all, new Set(['s']), ['t', 'q', 'zzz']);
  assert.deepEqual([...out.map(x => x.id)], ['s', 't', 'q', 'r']);
});

test('video files by name', () => {
  assert.ok(w.isVideoFile('clip_00001.mp4'));
  assert.ok(!w.isVideoFile('ImageLab_00001_.png'));
});
