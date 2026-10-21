// The model viewer's pure layer: file → CivitAI ids through the hash cache, generation meta →
// rows, licence chips, and the formatters. `modelHash` is the real module (it imports only types).
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');

const modelHash = load('../src/lib/modelHash.ts');
const L = load('src/screens/modelViewer/modelViewerLogic.ts', { '@/lib/modelHash': modelHash });

const hashes = [
  { key: 'checkpoints/SDXL/pony.safetensors', filename: 'pony.safetensors', hash: 'ABCDEF0123456789', hashed_at: 1 },
  { key: 'embeddings/easynegative.pt', filename: 'easynegative.pt', hash: 'FEDCBA9876543210', hashed_at: 1 },
];
const found = { hash: 'ABCDEF0123456789', status: 'found', fetchedAt: 1, data: { id: 22, modelId: 11, name: 'v6', model: { name: 'Pony', type: 'Checkpoint' }, images: [{ url: 'u', width: 1, height: 1, nsfwLevel: 1, meta: null }] } };
const missing = { hash: 'FEDCBA9876543210', status: 'not-found', fetchedAt: 1, data: null };

test('resolveFileTarget: the file name goes through the hash list to the cached by-hash version', () => {
  assert.deepEqual(L.resolveFileTarget('SDXL/pony.safetensors', hashes, { ABCDEF0123456789: found }), { modelId: 11, versionId: 22 });
  assert.deepEqual(L.resolveFileTarget('pony.safetensors', hashes, { ABCDEF0123456789: found }), { modelId: 11, versionId: 22 });
  assert.equal(L.resolveFileTarget('SDXL/pony.safetensors', hashes, {}), null);
  assert.equal(L.resolveFileTarget('easynegative', hashes, { FEDCBA9876543210: missing }), null);
  assert.equal(L.resolveFileTarget('nope.safetensors', hashes, { ABCDEF0123456789: found }), null);
  assert.equal(L.resolveFileTarget('pony.safetensors', hashes, { ABCDEF0123456789: { ...found, data: { name: 'no ids' } } }), null);
});

test('fileLookupState tells pending from unhashed from not-on-civitai', () => {
  assert.equal(L.fileLookupState('pony.safetensors', [], {}), 'pending');
  assert.equal(L.fileLookupState('other.safetensors', hashes, {}), 'unhashed');
  assert.equal(L.fileLookupState('pony.safetensors', hashes, {}), 'pending');
  assert.equal(L.fileLookupState('pony.safetensors', hashes, { ABCDEF0123456789: found }), 'found');
  assert.equal(L.fileLookupState('easynegative', hashes, { FEDCBA9876543210: missing }), 'not-on-civitai');
  assert.equal(L.fileLookupState('easynegative', hashes, { FEDCBA9876543210: { ...missing, status: 'error' } }), 'error');
});

test('folderOfKey and modelFromVersion', () => {
  assert.equal(L.folderOfKey('checkpoints/SDXL/pony.safetensors'), 'checkpoints');
  assert.equal(L.folderOfKey('pony.safetensors'), '');
  assert.equal(L.folderOfKey(undefined), '');
  const m = L.modelFromVersion(found.data, 'pony');
  assert.equal(m.id, 11);
  assert.equal(m.name, 'Pony');
  assert.equal(m.type, 'Checkpoint');
  assert.equal(m.modelVersions[0].id, 22);
  assert.equal(L.modelFromVersion({ ...found.data, model: undefined }, 'pony').name, 'pony');
});

test('metaRows: the named rows first in a fixed order, then the rest; prompts and blobs stay out', () => {
  const rows = L.metaRows({
    prompt: 'a cat', negativePrompt: 'dog', seed: 42, steps: 30, sampler: 'DPM++ 2M', cfgScale: 7, Size: '1024x1024',
    'Clip skip': '2', 'Model hash': 'abc12345', Model: 'pony', resources: [{ name: 'x' }], hashes: { model: 'abc' },
    'Schedule type': 'Karras', Denoising: 0.4, nothing: '', empty: null,
  });
  assert.deepEqual(rows.slice(0, 7).map(([l]) => l), ['Sampler', 'Scheduler', 'Steps', 'CFG', 'Seed', 'Size', 'Clip skip']);
  assert.deepEqual(rows.find(([l]) => l === 'Scheduler'), ['Scheduler', 'Karras']);
  assert.deepEqual(rows.find(([l]) => l === 'Model hash'), ['Model hash', 'abc12345']);
  assert.deepEqual(rows[rows.length - 1], ['Denoising', '0.4']);
  assert.ok(!rows.some(([l]) => ['prompt', 'negativePrompt', 'resources', 'hashes', 'nothing', 'empty'].includes(l)));
  assert.deepEqual(L.metaRows(null), []);
  assert.deepEqual(L.metaRows({}), []);
});

test('metaRows stringifies objects and lists', () => {
  const rows = L.metaRows({ extra: ['a', 'b'], obj: { name: 'Detail', type: 'lora', weight: 0.8 }, flag: true });
  assert.deepEqual(rows, [['extra', 'a, b'], ['obj', 'Detail (lora) ×0.8'], ['flag', 'true']]);
});

test('metaResources merges resources and civitaiResources; metaHashes flattens the map', () => {
  const r = L.metaResources({ resources: [{ name: 'Detail', type: 'lora', weight: 0.8, hash: 'abc' }, 'junk'], civitaiResources: [{ modelVersionId: 9, type: 'checkpoint' }] });
  assert.deepEqual(r, [{ name: 'Detail', type: 'lora', weight: 0.8, hash: 'abc' }, { name: 'version 9', type: 'checkpoint' }]);
  assert.deepEqual(L.metaResources({}), []);
  assert.deepEqual(L.metaHashes({ hashes: { model: 'abc', 'lora:x': 'def', bad: 1 } }), [['model', 'abc'], ['lora:x', 'def']]);
  assert.deepEqual(L.metaHashes({ Hashes: { model: 'abc' } }), [['model', 'abc']]);
  assert.deepEqual(L.metaHashes({ hashes: 'nope' }), []);
});

test('isCopyable: hashes, seeds, ids and hex strings', () => {
  assert.equal(L.isCopyable('Seed', '42'), true);
  assert.equal(L.isCopyable('Model hash', 'x'), true);
  assert.equal(L.isCopyable('Steps', '30'), false);
  assert.equal(L.isCopyable('thing', 'abcdef1234'), true);
  assert.equal(L.isCopyable('Sampler', 'DPM++ 2M'), false);
});

test('fmtDate is "12 Mar 2026"; shortHash upper-cases the first 10', () => {
  assert.equal(L.fmtDate('2026-03-12T12:00:00.000Z'), '12 Mar 2026');
  assert.equal(L.fmtDate(''), '');
  assert.equal(L.fmtDate('not a date'), '');
  assert.equal(L.fmtDate(undefined), '');
  assert.equal(L.shortHash('abcdef0123456789abcdef'), 'ABCDEF0123');
  assert.equal(L.shortHash('abc', 8), 'ABC');
  assert.equal(L.shortHash(undefined), '');
});

test('fileHashRows puts SHA256 first and drops empties; clampIndex stays in range', () => {
  assert.deepEqual(L.fileHashRows({ CRC32: 'c', AutoV2: 'a', SHA256: 's', BLAKE3: '' }), [['SHA256', 's'], ['AutoV2', 'a'], ['CRC32', 'c']]);
  assert.deepEqual(L.fileHashRows(undefined), []);
  assert.equal(L.clampIndex(5, 3), 2);
  assert.equal(L.clampIndex(-1, 3), 0);
  assert.equal(L.clampIndex(1, 0), 0);
  assert.equal(L.clampIndex(1.7, 3), 1);
});

test('licenceChips: the same facts as the detail head', () => {
  const chips = L.licenceChips({ allowCommercialUse: ['Image', 'RentCivit'], allowNoCredit: false, allowDerivatives: false, allowDifferentLicense: false, poi: true, nsfw: true }, true);
  assert.deepEqual(chips.map((c) => c.label), ['Early access', 'Commercial', 'Rent', 'Sell', 'Credit required', 'No derivatives', 'Same licence only', 'Real person', 'NSFW']);
  assert.equal(chips.find((c) => c.label === 'Commercial').ok, true);
  assert.equal(chips.find((c) => c.label === 'Rent').ok, true);
  assert.equal(chips.find((c) => c.label === 'Sell').ok, false);
  assert.equal(chips.find((c) => c.label === 'No derivatives').ok, false);
  const plain = L.licenceChips({ allowCommercialUse: [], allowNoCredit: true, allowDerivatives: true, allowDifferentLicense: true }, false);
  assert.deepEqual(plain.map((c) => c.label), ['Commercial', 'Rent', 'Sell', 'No credit needed', 'Derivatives']);
});

test('neighbourOrder: current first, then +1, −1, +2, −2, clipped to the list', () => {
  assert.deepEqual(L.neighbourOrder(5, 20), [5, 6, 4, 7, 3]);
  assert.deepEqual(L.neighbourOrder(0, 20), [0, 1, 2]);
  assert.deepEqual(L.neighbourOrder(19, 20), [19, 18, 17]);
  assert.deepEqual(L.neighbourOrder(1, 3), [1, 2, 0]);
  assert.deepEqual(L.neighbourOrder(0, 1), [0]);
  assert.deepEqual(L.neighbourOrder(0, 0), []);
  assert.deepEqual(L.neighbourOrder(3, 10, 1), [3, 4, 2]);
});

test('nearEnd: within 3 of the last item, never on an empty list', () => {
  assert.equal(L.nearEnd(0, 20), false);
  assert.equal(L.nearEnd(15, 20), false);
  assert.equal(L.nearEnd(16, 20), true);
  assert.equal(L.nearEnd(19, 20), true);
  assert.equal(L.nearEnd(0, 2), true);
  assert.equal(L.nearEnd(0, 0), false);
  assert.equal(L.nearEnd(5, 10, 1), false);
  assert.equal(L.nearEnd(8, 10, 1), true);
});

test('item 28: the creator samples come first, the gallery after, each picture once; gallery copies carry meta in place', () => {
  const key = (u) => u.split('#')[0];
  const samples = [{ url: 'a' }, { url: 'b' }, { url: 'a#dup' }];
  const gallery = [{ url: 'c', meta: 1 }, { url: 'b', meta: 2 }, { url: 'd', meta: 3 }];
  assert.deepEqual(L.mergeGallery(samples, gallery, key), [{ url: 'a' }, { url: 'b', meta: 2 }, { url: 'c', meta: 1 }, { url: 'd', meta: 3 }]);
  assert.deepEqual(L.mergeGallery([], gallery, key).map((i) => i.url), ['c', 'b', 'd']);
  assert.equal(L.counterText(2, 40, true), '3 / 40+');
  assert.equal(L.counterText(2, 128, false), '3 / 128');
  assert.equal(L.counterText(0, 0, false), '');
});
