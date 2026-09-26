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
const lib = load('modelLibrary');
const plain = value => JSON.parse(JSON.stringify(value));

const SHA = 'AB'.repeat(32);
const version = {
  id: 222, name: 'v2.0', baseModel: 'Illustrious', trainedWords: [], description: null, createdAt: '', stats: {},
  files: [
    { id: 1, name: 'extra.zip', sizeKB: 10, type: 'Training Data', hashes: {}, downloadUrl: 'https://civitai.com/api/download/models/222?type=Training' },
    { id: 2, name: 'cool.safetensors', sizeKB: 6_500_000, type: 'Model', primary: true, hashes: { SHA256: SHA }, downloadUrl: 'https://civitai.com/api/download/models/222' },
  ],
  images: [
    { url: 'https://image.civitai.com/x/abc/width=450/clip.mp4', type: 'video' },
    { url: 'https://image.civitai.com/x/abc/width=450/still.jpeg', type: 'image' },
  ],
};
const model = { id: 111, name: 'Cool Model', type: 'Checkpoint' };

test('an entry from CivitAI data carries what a re-download and the list need', () => {
  const e = lib.entryFromCivitai(model, version, 1000, 'red');
  assert.equal(e.versionId, 222);
  assert.equal(e.modelId, 111);
  assert.equal(e.fileName, 'cool.safetensors');
  assert.equal(e.sizeKB, 6_500_000);
  assert.equal(e.sha256, SHA.toLowerCase());
  assert.equal(e.thumbnailUrl, 'https://image.civitai.com/x/abc/width=450/still.jpeg');
  assert.equal(e.pageUrl, 'https://civitai.red/models/111?modelVersionId=222');
  assert.equal(e.downloadUrl, 'https://civitai.com/api/download/models/222');
  assert.equal(e.rating, 0);
  assert.equal(e.addedAt, 1000);
  assert.equal(e.lastDownloadedAt, 1000);
});

test('recording again bumps the download time but keeps first-added, rating and note', () => {
  let list = lib.recordEntry([], lib.entryFromCivitai(model, version, 1000), 1000);
  list = lib.setRating(list, 222, 4);
  list = lib.setNote(list, 222, '  great for portraits  ');
  list = lib.recordEntry(list, lib.entryFromCivitai({ ...model, name: 'Cool Model (renamed)' }, version, 5000), 5000);
  assert.equal(list.length, 1);
  assert.equal(list[0].addedAt, 1000);
  assert.equal(list[0].lastDownloadedAt, 5000);
  assert.equal(list[0].rating, 4);
  assert.equal(list[0].note, 'great for portraits');
  assert.equal(list[0].modelName, 'Cool Model (renamed)');
});

test('a bare entry (CivitAI unreachable) is filled in later without touching its times', () => {
  let list = lib.recordEntry([], lib.bareEntry(222, 1000), 1000);
  assert.ok(lib.needsDetails(list[0]));
  assert.equal(lib.displayName(list[0]), 'Version 222');
  list = lib.applyDetails(list, lib.entryFromCivitai(model, version, 9999));
  assert.equal(list[0].modelName, 'Cool Model');
  assert.equal(list[0].pageUrl, 'https://civitai.com/models/111?modelVersionId=222');
  assert.equal(list[0].addedAt, 1000);
  assert.equal(list[0].lastDownloadedAt, 1000);
  assert.ok(!lib.needsDetails(list[0]));
});

test('clicking the current star clears the rating', () => {
  assert.equal(lib.nextRating(0, 3), 3);
  assert.equal(lib.nextRating(3, 3), 0);
  assert.equal(lib.nextRating(3, 5), 5);
});

test('merge keeps the widest time span and an existing rating unless the import sets one', () => {
  const base = lib.entryFromCivitai(model, version, 0);
  const current = [
    { ...base, addedAt: 2000, lastDownloadedAt: 3000, rating: 5, note: 'mine' },
    { ...base, versionId: 333, addedAt: 100, lastDownloadedAt: 100, rating: 2, note: '' },
  ];
  const incoming = [
    { ...base, addedAt: 1000, lastDownloadedAt: 2500, rating: 0, note: '', modelName: 'Older name' },
    { ...base, versionId: 333, addedAt: 50, lastDownloadedAt: 9000, rating: 4, note: 'theirs', modelName: 'Newer name' },
    { ...base, versionId: 444, addedAt: 70, lastDownloadedAt: 70 },
  ];
  const { entries, added, updated } = lib.mergeEntries(current, incoming);
  assert.equal(added, 1);
  assert.equal(updated, 2);
  const by = Object.fromEntries(entries.map(e => [e.versionId, e]));
  assert.equal(by[222].addedAt, 1000);
  assert.equal(by[222].lastDownloadedAt, 3000);
  assert.equal(by[222].rating, 5);
  assert.equal(by[222].note, 'mine');
  assert.equal(by[222].modelName, 'Cool Model'); // the current side downloaded last
  assert.equal(by[333].addedAt, 50);
  assert.equal(by[333].lastDownloadedAt, 9000);
  assert.equal(by[333].rating, 4);
  assert.equal(by[333].note, 'theirs');
  assert.equal(by[333].modelName, 'Newer name');
  assert.ok(by[444]);
  // Merging the same list twice changes nothing.
  assert.equal(lib.mergeEntries(entries, incoming).updated, 0);
});

test('export has a version, a kind and every entry, and round-trips through import', () => {
  const list = [lib.entryFromCivitai(model, version, 1000)];
  const file = lib.exportLibrary(list, Date.UTC(2026, 8, 25));
  assert.equal(file.version, lib.MODEL_LIBRARY_VERSION);
  assert.equal(file.kind, 'model-library');
  assert.equal(file.app, 'imagelab');
  assert.equal(file.exportedAt, '2026-09-25T00:00:00.000Z');
  assert.equal(file.entries.length, 1);
  const back = lib.parseLibraryText(JSON.stringify(file));
  assert.ok(back.ok);
  // Only the private form travels: the same entry, minus everything that names the model.
  assert.deepEqual(plain(back.entries.map(lib.privateEntry)), plain(list.map(lib.privateEntry)));
  assert.equal(lib.exportFileName(new Date(2026, 0, 5)), 'imagelab-models-2026-01-05.json');
});

test('import rejects files that are not a model list, with a readable reason', () => {
  const bad = [
    ['not json', /not valid JSON/],
    ['"hello"', /not an ImageLab model list/],
    ['{"kind":"something-else","entries":[]}', /not an ImageLab model list/],
    ['{"version":1}', /no list of models/],
    ['{"version":99,"entries":[]}', /newer ImageLab/],
    ['{"version":"one","entries":[]}', /unreadable version/],
    ['{"entries":[{"modelName":"no id"},{"versionId":-4}]}', /version id/],
  ];
  for (const [text, message] of bad) {
    const r = lib.parseLibraryText(text);
    assert.equal(r.ok, false, text);
    assert.match(r.error, message, text);
  }
});

test('import cleans rows: skips unusable ones, clamps ratings, drops unsafe urls, merges duplicates', () => {
  const r = lib.validateLibraryFile({
    version: 1,
    entries: [
      { versionId: '222', modelId: 111, modelName: 'A', rating: 9, thumbnailUrl: 'javascript:alert(1)', sha256: 'nope', addedAt: '2026-01-01T00:00:00Z' },
      { versionId: 222, rating: 0, lastDownloadedAt: Date.UTC(2026, 5, 1) },
      { versionId: 0 },
      null,
      'string',
    ],
  });
  assert.ok(r.ok);
  assert.equal(r.skipped, 3);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.versionId, 222);
  assert.equal(e.rating, 5);
  assert.equal(e.thumbnailUrl, '');
  assert.equal(e.sha256, '');
  assert.equal(e.addedAt, Date.UTC(2026, 0, 1));
  assert.equal(e.lastDownloadedAt, Date.UTC(2026, 5, 1));
  assert.equal(e.pageUrl, 'https://civitai.com/models/111?modelVersionId=222');
  // A bare array of entries is accepted too, and an empty list is fine.
  assert.ok(lib.validateLibraryFile([{ versionId: 5 }]).ok);
  assert.ok(lib.validateLibraryFile({ version: 1, entries: [] }).ok);
});

test('search, type filter and sort', () => {
  const mk = (versionId, modelName, type, addedAt, rating) => ({ ...lib.bareEntry(versionId, addedAt), modelName, type, rating });
  const list = [mk(1, 'Zeta', 'LORA', 10, 3), mk(2, 'alpha', 'Checkpoint', 30, 0), mk(3, 'Beta detail', 'LORA', 20, 5)];
  const ids = q => lib.viewEntries(list, { search: '', type: '', sort: 'added', ...q }).map(e => e.versionId);
  assert.deepEqual(ids({}), [2, 3, 1]);
  assert.deepEqual(ids({ sort: 'name' }), [2, 3, 1]);
  assert.deepEqual(ids({ sort: 'rating' }), [3, 1, 2]);
  assert.deepEqual(ids({ type: 'LORA' }), [3, 1]);
  assert.deepEqual(ids({ search: 'DETAIL beta' }), [3]);
  assert.deepEqual(plain(lib.libraryTypes(list)), ['Checkpoint', 'LORA']);
});

test('installed matching: subfolders, extensionless embeddings, and renamed files found by hash', () => {
  const info = { samplers: ['cool.safetensors'], models: ['SDXL/cool.safetensors'], loras: [], embeddings: ['easyneg'] };
  assert.equal(lib.serverHasFile(info, ['cool.safetensors']), true);
  assert.equal(lib.serverHasFile({ samplers: ['cool.safetensors'] }, ['cool.safetensors']), false);
  assert.equal(lib.serverHasFile(info, ['easyneg.safetensors']), true);
  assert.equal(lib.serverHasFile(info, ['other.safetensors']), false);
  assert.equal(lib.serverHasFile(undefined, ['cool.safetensors']), false);
  const e = { ...lib.bareEntry(1, 0), fileName: 'orig.safetensors', sha256: SHA.toLowerCase() };
  const { names, hashMatch } = lib.knownFileNames(e, [{ hash: SHA.toLowerCase(), filename: 'renamed.safetensors' }]);
  assert.equal(hashMatch, true);
  assert.deepEqual(plain(names), ['orig.safetensors', 'renamed.safetensors']);
});

test('saved and exported entries keep only links and the user\'s own marks', () => {
  const e = { ...lib.entryFromCivitai(model, version, 1000), rating: 4, note: 'mine' };
  const file = lib.exportLibrary([e], 2000);
  const row = plain(file.entries[0]);
  assert.deepEqual(Object.keys(row).sort(), ['addedAt', 'downloadUrl', 'lastDownloadedAt', 'modelId', 'note', 'pageUrl', 'rating', 'versionId'].concat(e.catalog ? ['catalog'] : []).sort());
  const text = JSON.stringify(file);
  for (const leak of [e.modelName, e.versionName, e.fileName, e.thumbnailUrl, e.sha256].filter(Boolean)) {
    assert.ok(!text.includes(leak), `export leaks ${leak}`);
  }
  const back = lib.parseLibraryText(text);
  assert.ok(back.ok);
  assert.equal(back.entries[0].rating, 4);
  assert.equal(back.entries[0].note, 'mine');
  assert.ok(lib.needsDetails(back.entries[0]));
});

test('seeding from the servers adds only versions the list lacks', () => {
  const byHash = (id, name) => ({ id, modelId: id + 1000, name: 'v1', baseModel: 'Illustrious', model: { name, type: 'LORA' },
    files: [{ name: name + '.safetensors', sizeKB: 10, primary: true, hashes: { SHA256: 'AB'.repeat(32) } }], images: [], trainedWords: [] });
  const list = [{ ...lib.bareEntry(1, 5), rating: 3 }];
  const r = lib.seedEntries(list, [byHash(1, 'Old'), byHash(2, 'New'), byHash(2, 'New')], 9);
  assert.equal(r.added, 1);
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].rating, 3);
  assert.equal(r.entries[1].versionId, 2);
  assert.equal(r.entries[1].modelName, 'New');
  assert.equal(r.entries[1].type, 'LORA');
  assert.equal(lib.seedEntries(r.entries, [byHash(2, 'New')], 10).added, 0);
});
