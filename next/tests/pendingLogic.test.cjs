const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/screens/image/model/pendingLogic.ts');

const pick = (over = {}) => ({
  installed: false, file: null,
  model: { id: 11, name: 'Detail Tweaker XL', type: 'LORA', baseModel: 'SDXL 1.0' },
  version: { id: 22, name: 'v1.0', trainedWords: ['add detail'], file: { name: 'add-detail-xl.safetensors' } },
  thumb: 'https://x/thumb.jpg', ...over,
});

test('expectedFileName: base name of the file; embeddings drop the extension', () => {
  assert.equal(P.expectedFileName('lora', pick()), 'add-detail-xl.safetensors');
  assert.equal(P.expectedFileName('lora', pick({ file: 'SDXL/other.safetensors' })), 'other.safetensors');
  assert.equal(P.expectedFileName('embedding', pick({ version: { id: 1, name: 'v', trainedWords: [], file: { name: 'easynegative.pt' } } })), 'easynegative');
  assert.equal(P.expectedFileName('lora', pick({ version: { id: 1, name: 'v', trainedWords: [] } })), '');
});

test('recordFromPick + pendingKey', () => {
  const r = P.recordFromPick('lora', pick(), 1000, 'entry-1', true, 0.8);
  assert.equal(r.key, 'lora:add-detail-xl.safetensors');
  assert.equal(P.pendingKey('lora', 'Add-Detail-XL.safetensors'), r.key);
  assert.deepEqual(r.trainedWords, ['add detail']);
  assert.equal(r.baseModel, 'SDXL 1.0');
  assert.equal(r.entryId, 'entry-1');
});

test('findInstalledName: exact, in a subfolder, embeddings by stem; never a different file', () => {
  const list = ['SDXL/add-detail-xl.safetensors', 'film.safetensors'];
  assert.equal(P.findInstalledName(list, 'add-detail-xl.safetensors', 'lora'), 'SDXL/add-detail-xl.safetensors');
  assert.equal(P.findInstalledName(list, 'ADD-DETAIL-XL.safetensors', 'lora'), 'SDXL/add-detail-xl.safetensors');
  assert.equal(P.findInstalledName(list, 'detail.safetensors', 'lora'), undefined);
  assert.equal(P.findInstalledName(['easynegative'], 'easynegative', 'embedding'), 'easynegative');
  assert.equal(P.findInstalledName(['easynegative'], 'easynegative.pt', 'embedding'), 'easynegative');
  assert.equal(P.findInstalledName([], 'x', 'lora'), undefined);
});

test('reconcile splits landed from waiting', () => {
  const a = P.recordFromPick('lora', pick(), 1);
  const b = P.recordFromPick('checkpoint', pick({ version: { id: 3, name: 'v', trainedWords: [], file: { name: 'pony.safetensors' } } }), 1);
  const out = P.reconcile([a, b], { checkpoint: [], lora: ['loras/sub/add-detail-xl.safetensors'], embedding: [], controlnet: [] });
  assert.equal(out.landed.length, 1);
  assert.equal(out.landed[0].file, 'loras/sub/add-detail-xl.safetensors');
  assert.deepEqual(out.waiting.map((r) => r.key), [b.key]);
});

test('downloadProgress prefers the active row, else the latest word', () => {
  assert.equal(P.downloadProgress([], 22), null);
  assert.deepEqual(P.downloadProgress([{ version_id: 22, status: 'downloading', percent: 42 }, { version_id: 22, status: 'completed', percent: 100 }], 22), { status: 'downloading', percent: 42, error: undefined });
  assert.equal(P.downloadProgress([{ version_id: 22, status: 'failed', percent: 0, error: 'boom' }], 22).error, 'boom');
  assert.equal(P.downloadProgress([{ version_id: 9, status: 'downloading', percent: 1 }], 22), null);
});

test('metaWithPending fills from the record only while the cache is empty', () => {
  const r = P.recordFromPick('lora', pick(), 1);
  const empty = { resolved: false, images: [], trainedWords: [] };
  const m = P.metaWithPending(empty, r);
  assert.equal(m.name, 'Detail Tweaker XL');
  assert.deepEqual(m.images, ['https://x/thumb.jpg']);
  assert.deepEqual(m.trainedWords, ['add detail']);
  assert.equal(m.civitaiUrl, 'https://civitai.com/models/11?modelVersionId=22');
  const known = { resolved: true, name: 'From cache', images: ['a'], trainedWords: ['x'], civitaiUrl: 'u' };
  assert.deepEqual(P.metaWithPending(known, r), known);
  assert.deepEqual(P.metaWithPending(empty, undefined), empty);
});

test('folderForKind', () => {
  assert.deepEqual(['checkpoint', 'lora', 'embedding', 'controlnet'].map(P.folderForKind), ['checkpoints', 'loras', 'embeddings', 'controlnet']);
});
