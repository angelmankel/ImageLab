// Wan 2.2 LoRA pairs (one entry = the high-noise + the low-noise file): which of a CivitAI
// version's files are the pair, what one pick fills, which halves must still download — and the
// video slot layer's view of a pair (circle badge, landing a half, the other half still waiting).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const P = load('src/screens/image/model/pendingLogic.ts');
const S = load('src/screens/image/model/kindSpecs.ts', { './pendingLogic': P });
const V = load('src/screens/image/video/videoKinds.ts', { '../model/kindSpecs': S, '../model/pendingLogic': P });
const W = load('src/screens/image/video/wanLoraPair.ts', { '../model/pendingLogic': P });

const HIGH = { name: 'wan2.2_anime_v2_high_noise.safetensors', downloadUrl: 'https://civitai.com/api/download/models/50?type=Model&format=SafeTensor&id=1', primary: true, type: 'Model' };
const LOW = { name: 'wan2.2_anime_v2_low_noise.safetensors', downloadUrl: 'https://civitai.com/api/download/models/50?type=Model&format=SafeTensor&id=2', type: 'Model' };
const pick = (over = {}) => ({
  installed: false, file: null,
  model: { id: 5, name: 'Anime Style', type: 'LORA', baseModel: 'Wan Video 2.2 T2V-A14B' },
  version: { id: 50, name: 'v2', trainedWords: ['anime'], file: HIGH, files: [HIGH, LOW] },
  ...over,
});

test('noiseOf: the word high / low in the file name, as a word; both or neither → null', () => {
  assert.equal(W.noiseOf('wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors'), 'high');
  assert.equal(W.noiseOf('Wan22_AnimeStyle_LowNoise.safetensors'), 'low');
  assert.equal(W.noiseOf('loras/anime_high.safetensors'), 'high');
  assert.equal(W.noiseOf('v2low.safetensors'), 'low');
  assert.equal(W.noiseOf('style_highlow_merged.safetensors'), null, 'high followed by letters');
  assert.equal(W.noiseOf('flowstyle.safetensors'), null, 'flow is not low');
  assert.equal(W.noiseOf('slowmo_v1.safetensors'), null);
  assert.equal(W.noiseOf('lowrank_x.safetensors'), null);
  assert.equal(W.noiseOf('HIGH_and_LOW.safetensors'), null, 'says both');
  assert.equal(W.noiseOf('style.safetensors'), null);
});

test('splitHighLow: the high and low model files of a version; not a pair without both', () => {
  assert.deepEqual(W.splitHighLow([HIGH, LOW]), { high: HIGH, low: LOW });
  assert.deepEqual(W.splitHighLow([LOW, { name: 'train.zip', type: 'Training Data' }, HIGH]), { high: HIGH, low: LOW });
  assert.equal(W.splitHighLow([HIGH]), null);
  assert.equal(W.splitHighLow([HIGH, { name: 'notes_low.zip', type: 'Training Data' }]), null, 'a zip is not a model file');
  assert.equal(W.splitHighLow([{ name: 'a.safetensors' }, { name: 'b.safetensors' }]), null);
  assert.equal(W.splitHighLow(undefined), null);
  assert.equal(W.splitHighLow([]), null);
});

test('versionDownloadFile mirrors the pod: primary, else the first safetensors, else the first', () => {
  assert.equal(W.versionDownloadFile([LOW, HIGH]), HIGH);
  assert.equal(W.versionDownloadFile([{ name: 'a.ckpt' }, { name: 'b.safetensors' }]).name, 'b.safetensors');
  assert.equal(W.versionDownloadFile([{ name: 'a.ckpt' }]).name, 'a.ckpt');
  assert.equal(W.versionDownloadFile([]), undefined);
});

test('one pick of a pair version fills both slots; the half the version download does not bring is fetched by URL', () => {
  const plan = W.planPairPick(pick(), 'add', []);
  assert.equal(plan.name, HIGH.name);
  assert.equal(plan.nameLow, LOW.name);
  assert.deepEqual(plan.pending, [{ file: HIGH.name }, { file: LOW.name, downloadUrl: LOW.downloadUrl }]);
  // The low file is the primary: then the high one goes by URL.
  const lowPrimary = pick({ version: { id: 50, name: 'v2', trainedWords: [], file: { ...LOW, primary: true }, files: [{ ...HIGH, primary: false }, { ...LOW, primary: true }] } });
  const p2 = W.planPairPick(lowPrimary, 'add', []);
  assert.deepEqual(p2.pending, [{ file: HIGH.name, downloadUrl: HIGH.downloadUrl }, { file: LOW.name }]);
  // Installed halves take the server's name and wait for nothing.
  const p3 = W.planPairPick(pick({ installed: true, file: 'Wan/wan2.2_anime_v2_low_noise.safetensors' }), 'add', ['Wan/wan2.2_anime_v2_low_noise.safetensors']);
  assert.equal(p3.nameLow, 'Wan/wan2.2_anime_v2_low_noise.safetensors');
  assert.equal(p3.name, HIGH.name);
  assert.deepEqual(p3.pending, [{ file: HIGH.name }], 'the high one is the primary: the version download brings it');
  const p4 = W.planPairPick(pick({ installed: true, file: 'wan2.2_anime_v2_high_noise.safetensors' }), 'add', ['wan2.2_anime_v2_high_noise.safetensors', 'sub/wan2.2_anime_v2_low_noise.safetensors']);
  assert.deepEqual([p4.name, p4.nameLow, p4.pending], ['wan2.2_anime_v2_high_noise.safetensors', 'sub/wan2.2_anime_v2_low_noise.safetensors', []]);
  // Changing the high slot with a pair version fills both too; the low slot takes only the low file.
  assert.deepEqual(W.planPairPick(pick(), 'high', []).nameLow, LOW.name);
  const low = W.planPairPick(pick(), 'low', []);
  assert.equal(low.name, undefined);
  assert.equal(low.nameLow, LOW.name);
  assert.deepEqual(low.pending, [{ file: LOW.name, downloadUrl: LOW.downloadUrl }]);
});

test('a single-file version fills the slot it was picked for', () => {
  const one = { name: 'style.safetensors', downloadUrl: 'u', primary: true };
  const single = pick({ version: { id: 51, name: 'v1', trainedWords: [], file: one } });
  assert.deepEqual(W.planPairPick(single, 'add', []), { name: 'style.safetensors', nameLow: null, pending: [{ file: 'style.safetensors' }] });
  assert.deepEqual(W.planPairPick(single, 'high', []), { name: 'style.safetensors', pending: [{ file: 'style.safetensors' }] }, 'a change of the high file leaves the low slot alone');
  assert.deepEqual(W.planPairPick(single, 'low', []), { nameLow: 'style.safetensors', pending: [{ file: 'style.safetensors' }] });
  assert.deepEqual(W.planPairPick(single, 'add', ['x/style.safetensors']), { name: 'x/style.safetensors', nameLow: null, pending: [] });
  // An installed pick from the server-file grid: the server's name, nothing to download.
  const grid = { installed: true, file: 'loras/foo.safetensors', model: { id: 0, name: 'foo', type: '' }, version: { id: 0, name: '', trainedWords: [] } };
  assert.deepEqual(W.planPairPick(grid, 'low', []), { nameLow: 'loras/foo.safetensors', pending: [] });
  // Nothing to use at all.
  assert.deepEqual(W.planPairPick({ ...grid, installed: false, file: null }, 'add', []), { pending: [] });
});

test('highSlotLabel says what the main file is', () => {
  assert.equal(W.highSlotLabel({ nameLow: 'l', expert: 'low' }), 'High noise');
  assert.equal(W.highSlotLabel({ expert: 'high' }), 'High noise');
  assert.equal(W.highSlotLabel({ expert: 'low' }), 'Low noise');
  assert.equal(W.highSlotLabel({ expert: 'both' }), 'Both experts · one file');
});

test('a pending record for a pair\'s other half: its own file and URL; the download row key is the URL\'s', () => {
  const r = P.recordFromPick('lora', pick(), 7, 'L1', true, 1, { scope: 'video', folder: 'loras', list: 'loras', file: LOW.name, downloadUrl: LOW.downloadUrl });
  assert.equal(r.key, 'lora:wan2.2_anime_v2_low_noise.safetensors');
  assert.equal(r.file, LOW.name);
  assert.equal(r.downloadUrl, LOW.downloadUrl);
  assert.equal(r.versionId, 50);
  assert.equal(P.crc32('hello'), 0x3610a686, 'zlib.crc32');
  assert.equal(P.urlKey('https://x/y'), -(P.crc32('https://x/y') & 0x7fffffff) - 1);
  assert.ok(P.urlKey(LOW.downloadUrl) < 0);
  assert.equal(P.recordDownloadKey(r), P.urlKey(LOW.downloadUrl));
  const plain = P.recordFromPick('lora', pick(), 7, 'L1');
  assert.equal(plain.downloadUrl, undefined);
  assert.equal(plain.file, HIGH.name);
  assert.equal(P.recordDownloadKey(plain), 50);
});

// ── the video slot layer's view of a pair ─────────────────────────────────

const video = (loras) => ({
  engine: 'wan', mode: 't2v',
  models: { t2v: { high: 't2v_high.safetensors', low: 't2v_low.safetensors' }, i2v: { high: 'i2v_high.safetensors', low: 'i2v_low.safetensors' } },
  textEncoder: 'umt5.safetensors', vae: 'wan_2.1_vae.safetensors', loras,
  fast: false, fastLoras: { t2v: { high: 'lx_t2v_high.safetensors', low: 'lx_t2v_low.safetensors' }, i2v: { high: 'lx_i2v_high.safetensors', low: 'lx_i2v_low.safetensors' } },
  h3: { mode: 't2v', models: { fl2va: 'f', ref2va: 'r' }, textEncoder: 'q', videoVae: 'vv', audioVae: 'av', loras: [] },
});
const PAIR = { id: 'L1', name: 'anime_high.safetensors', nameLow: 'anime_low.safetensors', strength: 0.8, on: false, expert: 'both' };

test('a pair is one circle badged H+L; a single file says its expert', () => {
  const v = video([PAIR, { id: 'L2', name: 'one.safetensors', strength: 1, on: true, expert: 'high' }, { id: 'L3', name: 'two.safetensors', strength: 1, on: true, expert: 'both' }]);
  assert.deepEqual(V.videoEntries(v, 'lora').slice(0, 3).map((e) => [e.id, e.name, e.badge]), [['L1', 'anime_high.safetensors', 'H+L'], ['L2', 'one.safetensors', 'High'], ['L3', 'two.safetensors', undefined]]);
});

test('both halves are held; the low one lands on nameLow, the high one on name', () => {
  const v = video([PAIR]);
  assert.deepEqual(V.videoSlotsHolding(v, 'lora', 'ANIME_LOW.safetensors'), ['L1:low']);
  assert.deepEqual(V.videoSlotsHolding(v, 'lora', 'anime_high.safetensors'), ['L1']);
  assert.equal(V.videoHasFile(v, 'lora', 'anime_low.safetensors'), true);
  const low = V.videoLandPatch(v, 'lora', 'anime_low.safetensors', 'Wan/anime_low.safetensors', true);
  assert.deepEqual(low.loras[0], { ...PAIR, nameLow: 'Wan/anime_low.safetensors', on: true });
  const high = V.videoLandPatch(v, 'lora', 'anime_high.safetensors', 'Wan/anime_high.safetensors', false);
  assert.deepEqual(high.loras[0], { ...PAIR, name: 'Wan/anime_high.safetensors', on: false });
  // The experts' own `…:low` ids are not a pair's.
  const ck = V.videoLandPatch(video([]), 'checkpoint', 't2v_low.safetensors', 'W/t2v_low.safetensors', true);
  assert.equal(ck.models.t2v.low, 'W/t2v_low.safetensors');
  assert.equal(V.videoLandPatch(video([]), 'lora', 'lx_i2v_low.safetensors', 'speed/lx_i2v_low.safetensors', true).fastLoras.i2v.low, 'speed/lx_i2v_low.safetensors');
});

test('pairHalfWaiting: a landed half stays Off while the other half is still pending', () => {
  const v = video([PAIR, { id: 'L2', name: 'one.safetensors', strength: 1, on: true, expert: 'high' }]);
  const waiting = (f) => f === 'anime_low.safetensors';
  assert.equal(V.pairHalfWaiting(v, 'anime_high.safetensors', waiting), true, 'the high landed, the low still waits');
  assert.equal(V.pairHalfWaiting(v, 'anime_low.safetensors', waiting), false, 'the low landed, the high is not waiting');
  assert.equal(V.pairHalfWaiting(v, 'one.safetensors', () => true), false, 'not a pair');
  assert.equal(V.pairHalfWaiting(v, 'nope.safetensors', () => true), false);
});

test('pairOtherHalf names the other file of the pair', () => {
  const v = video([PAIR]);
  assert.equal(V.pairOtherHalf(v, 'Anime_High.safetensors'), 'anime_low.safetensors');
  assert.equal(V.pairOtherHalf(v, 'anime_low.safetensors'), 'anime_high.safetensors');
  assert.equal(V.pairOtherHalf(v, 'other.safetensors'), null);
});
