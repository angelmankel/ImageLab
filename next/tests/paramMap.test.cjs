// Workflow steps' mapping layer (item 39): automatic roles, friendly labels and groups, user overrides.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const M = load('src/screens/image/workflow/paramMap.ts');

const P = (id, nodeId, nodeLabel, nodeType, name, type, over = {}) => ({ id, nodeId, nodeLabel, nodeType, name, type, value: 0, default: 0, multiline: false, seedLike: false, ...over });
const params = [
  P('3.text', 3, 'CLIP Text Encode (Prompt)', 'CLIPTextEncode', 'text', 'STRING', { multiline: true, value: 'a cat' }),
  P('4.text', 4, 'CLIP Text Encode (Prompt)', 'CLIPTextEncode', 'text', 'STRING', { multiline: true, value: '' }),
  P('5.seed', 5, 'KSampler', 'KSampler', 'seed', 'INT', { seedLike: true }),
  P('5.steps', 5, 'KSampler', 'KSampler', 'steps', 'INT'),
  P('5.cfg', 5, 'KSampler', 'KSampler', 'cfg', 'FLOAT'),
  P('5.sampler_name', 5, 'KSampler', 'KSampler', 'sampler_name', 'COMBO'),
  P('6.width', 6, 'Empty Latent Image', 'EmptyLatentImage', 'width', 'INT'),
  P('7.strength_model', 7, 'Detail LoRA', 'LoraLoader', 'strength_model', 'FLOAT'),
  P('8.steps', 8, 'KSampler', 'KSampler', 'steps', 'INT'),
];

test('detectNegative: titled box, else the other of exactly two', () => {
  assert.equal(M.detectNegative(params, '3.text'), '4.text');
  assert.equal(M.detectNegative(params, null), null);
  const titled = [...params, P('9.text', 9, 'Negative', 'CLIPTextEncode', 'text', 'STRING', { multiline: true })];
  assert.equal(M.detectNegative(titled, '3.text'), '9.text');
});

test('resolveParams: roles, friendly labels and groups, no raw node names', () => {
  const r = M.resolveParams(params, '3.text');
  const by = Object.fromEntries(r.map((x) => [x.p.id, x]));
  assert.equal(by['3.text'].role, 'positive');
  assert.equal(by['4.text'].role, 'negative');
  assert.equal(by['5.seed'].label, 'Seed');
  assert.equal(by['5.cfg'].group, 'Sampling');
  assert.equal(by['6.width'].group, 'Size');
  assert.equal(by['7.strength_model'].label, 'Strength model');
  assert.equal(by['7.strength_model'].group, 'Detail LoRA');
  assert.equal(by['5.steps'].sub, 'Sampler 1');
  assert.equal(by['8.steps'].sub, 'Sampler 2');
  for (const x of r) assert.ok(!/#\d|CLIP Text Encode/.test(`${x.label} ${x.group}`), x.label);
});

test('user mapping wins: label, group, hidden, role', () => {
  const r = M.resolveParams(params, '3.text', { '5.cfg': { label: 'Guidance scale', group: 'Main' }, '8.steps': { hidden: true }, '4.text': { role: 'none' } });
  const by = Object.fromEntries(r.map((x) => [x.p.id, x]));
  assert.equal(by['5.cfg'].label, 'Guidance scale');
  assert.equal(by['5.cfg'].group, 'Main');
  assert.equal(by['8.steps'].hidden, true);
  assert.equal(by['4.text'].role, null);
  const swap = M.resolveParams(params, '3.text', { '4.text': { role: 'positive' } });
  assert.equal(swap.find((x) => x.p.id === '4.text').role, 'positive');
  assert.equal(swap.find((x) => x.p.id === '3.text').role, 'negative');
});

test('friendlyNode keeps a user title, plain names for stock ones', () => {
  assert.equal(M.friendlyNode({ nodeLabel: 'CLIP Text Encode (Prompt)', nodeType: 'CLIPTextEncode' }), 'Text');
  assert.equal(M.friendlyNode({ nodeLabel: 'Empty Latent Image', nodeType: 'EmptyLatentImage' }), 'Size');
  assert.equal(M.friendlyNode({ nodeLabel: 'My upscaler', nodeType: 'ImageScale' }), 'My upscaler');
});

test('groupResolved: Sampling, Size first, then graph order', () => {
  const g = M.groupResolved(M.resolveParams(params, '3.text'));
  assert.deepEqual(g.map((x) => x.name), ['Sampling', 'Size', 'Prompt', 'Detail LoRA']);
});
