// Local (not-on-CivitAI) installed files show in the Downloaded list.
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const L = load('src/screens/models/localModels.ts');

test('baseKey / localId / localLabel', () => {
  assert.equal(L.baseKey('SDXL/Foo.SafeTensors'), 'foo');
  assert.equal(L.localLabel('SDXL/foo.safetensors'), 'foo');
  assert.ok(L.localId('lora', 'a') < 0);
  assert.equal(L.localId('lora', 'a'), L.localId('lora', 'a'));
  assert.notEqual(L.localId('lora', 'a'), L.localId('checkpoint', 'a'));
});

test('files CivitAI does not cover become local models; covered ones do not', () => {
  const known = [{ id: 1, modelVersions: [{ files: [{ name: 'knownModel.safetensors' }] }] }];
  const files = [
    { kind: 'checkpoint', name: 'SDXL/knownModel.safetensors', type: 'Checkpoint' },
    { kind: 'checkpoint', name: 'SDXL/mystery.safetensors', type: 'Checkpoint' },
    { kind: 'lora', name: 'mine.safetensors', type: 'LORA' },
    { kind: 'lora', name: 'mine.safetensors', type: 'LORA' },
  ];
  const out = L.localModelsFor(files, known, (n) => (n.endsWith('mine.safetensors') ? 'ABC' : undefined));
  assert.deepEqual(out.map((m) => m.name), ['mystery', 'mine']);
  assert.ok(out.every(L.isLocalModel));
  assert.equal(out[0].type, 'Checkpoint');
  assert.equal(out[0].modelVersions[0].files[0].name, 'mystery.safetensors');
  assert.equal(out[1].modelVersions[0].files[0].hashes.SHA256, 'ABC');
  assert.equal(out[0].creator.username, 'on the server · SDXL');
});
