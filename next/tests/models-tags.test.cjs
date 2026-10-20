// Tag browsing and the picker's pick (src/screens/models/tags.ts, pick.ts): pure, required from TypeScript.
const test = require('node:test');
const assert = require('node:assert');
const Tg = require('../src/screens/models/tags.ts');
const Pk = require('../src/screens/models/pick.ts');

const M = [
  { id: 1, name: 'Illustrious XL', tags: ['anime', 'base model', 'Style'], creator: { username: 'wai' } },
  { id: 2, name: 'Detail Tweaker', tags: ['detail', 'slider', 'anime'] },
  { id: 3, name: 'Niji Style', tags: ['anime', 'style', 'illustration'] },
  { id: 4, name: 'Photo Realism', tags: ['realistic', 'photography', 'portrait'] },
  { id: 5, name: 'Maid Outfit', tags: ['maid', 'clothing', 'anime'] },
  { id: 6, name: 'No tags' },
  { id: 7, name: 'Ink', tags: ['illustration', 'sketch'] },
];

test('groupOf: static groups, case folded; unknown → undefined', () => {
  assert.equal(Tg.groupOf('Anime'), 'Style');
  assert.equal(Tg.groupOf('maid'), 'Clothing');
  assert.equal(Tg.groupOf('openpose'), 'Pose');
  assert.equal(Tg.groupOf('sdxl'), 'Base');
  assert.equal(Tg.groupOf('vae'), 'Tool');
  assert.equal(Tg.groupOf('zzz-unknown'), undefined);
});

test('groupTags: groups in order, most used first, the rest under Most used, selected always present', () => {
  const g = Tg.groupTags(M, { selected: ['Gone'] });
  const names = g.map((x) => x.group);
  assert.deepEqual(names, ['Style', 'Character', 'Concept', 'Clothing', 'Tool', 'Most used']);
  const style = g.find((x) => x.group === 'Style').tags;
  assert.deepEqual(style[0], { tag: 'anime', count: 4 });
  assert.ok(style.some((t) => t.tag === 'style' && t.count === 2), 'Style and style fold to one tag');
  const most = g.find((x) => x.group === 'Most used').tags;
  assert.ok(most.some((t) => t.tag === 'gone' && t.count === 0), 'a selected tag with no model still shows');
  assert.ok(g.find((x) => x.group === 'Tool').tags.some((t) => t.tag === 'base model'));
  assert.ok(most.some((t) => t.tag === 'photography') === false, 'photography is a Style tag');
  assert.equal(Tg.groupTags([]).length, 0);
  assert.equal(Tg.groupTags(M, { limit: 1 }).find((x) => x.group === 'Style').tags.length, 1);
});

test('rankByTags: direct matches first (by how many picked tags), then neighbourhood overlap, no-overlap dropped', () => {
  const r = Tg.rankByTags(M, ['anime']);
  const ids = r.map((x) => x.model.id);
  // direct: 1, 2, 3, 5 (all carry anime); 7 shares 'illustration' with 3 → neighbourhood; 4 and 6 drop
  assert.deepEqual(ids.slice(0, 4).sort(), [1, 2, 3, 5]);
  assert.deepEqual(ids.slice(4), [7]);
  assert.ok(r.every((x) => x.model.id !== 4 && x.model.id !== 6));
  assert.ok(r.find((x) => x.model.id === 7).score < 1, 'a neighbour scores below any direct match');
  assert.equal(r.find((x) => x.model.id === 7).direct, 0);
  // two picked tags: the model with both sorts first
  const two = Tg.rankByTags(M, ['anime', 'style']);
  assert.deepEqual(two.slice(0, 2).map((x) => x.model.id).sort(), [1, 3], 'both carry anime + style (Style folds)');
  assert.equal(two[0].direct, 2);
  assert.equal(two[2].direct, 1);
  // nothing picked → everything, in order, score 0
  assert.deepEqual(Tg.rankByTags(M, []).map((x) => x.model.id), [1, 2, 3, 4, 5, 6, 7]);
  // case folding
  assert.equal(Tg.rankByTags(M, ['ANIME'])[0].direct, 1);
});

test('matchesText: name, tag, creator; empty matches all', () => {
  assert.equal(Tg.matchesText(M[0], ''), true);
  assert.equal(Tg.matchesText(M[0], 'illus'), true);
  assert.equal(Tg.matchesText(M[0], 'base model'), true);
  assert.equal(Tg.matchesText(M[0], 'WAI'), true);
  assert.equal(Tg.matchesText(M[0], 'photo'), false);
  assert.equal(Tg.matchesText(M[5], 'x'), false);
});

test('buildPick: primary file, hashes cleaned, installed only with a server file, thumb from the version', () => {
  const m = { id: 9, name: 'Foo', type: 'LORA', tags: ['a'], nsfw: false, modelVersions: [] };
  const v = { id: 90, name: 'v2', trainedWords: ['foo'], baseModel: 'Illustrious', images: [{ url: 'u1' }], files: [
    { name: 'train.zip', type: 'Training Data', downloadUrl: 'd0' },
    { name: 'foo.safetensors', type: 'Model', primary: true, sizeKB: 1024, downloadUrl: 'd1', metadata: { format: 'SafeTensor', fp: 'fp16' }, hashes: { SHA256: 'AB', AutoV2: undefined } },
  ] };
  const p = Pk.buildPick(m, v, { serverFile: 'loras/foo.safetensors' });
  assert.equal(p.installed, true);
  assert.equal(p.file, 'loras/foo.safetensors');
  assert.deepEqual(p.model, { id: 9, name: 'Foo', type: 'LORA', baseModel: 'Illustrious', tags: ['a'], nsfw: false });
  assert.equal(p.version.file.name, 'foo.safetensors');
  assert.equal(p.version.file.fp, 'fp16');
  assert.deepEqual(p.version.file.hashes, { SHA256: 'AB' });
  assert.deepEqual(p.version.trainedWords, ['foo']);
  assert.equal(p.thumb, 'u1');
  const q = Pk.buildPick(m, v, { thumb: 't' });
  assert.equal(q.installed, false);
  assert.equal(q.file, null);
  assert.equal(q.thumb, 't');
  assert.equal(Pk.buildPick(m, { id: 1, name: 'x' }).version.file, undefined);
  assert.equal(Pk.pickFile({ id: 1, name: 'x', files: [{ name: 'a', type: 'VAE' }, { name: 'b' }] }).name, 'b');
});
