// "Use same models as step 1" (fix list item 40): the pure diff that keeps a step's linked models
// in step with the Image step, the raw-node-name badge rule, which steps can follow.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');

const P = load('src/screens/image/model/pendingLogic.ts');
const F = load('src/screens/image/model/followLogic.ts', { './pendingLogic': P });

const FIXED = { canAdd: false, canRemove: false, hasSwitch: false, syncWeight: true };
const GROW = { canAdd: true, canRemove: true, hasSwitch: true, syncWeight: true };
const t = (id, name, over = {}) => ({ id, name, on: true, weight: 1, linked: true, ...over });
const s = (name, over = {}) => ({ name, on: true, weight: 1, ...over });

test('canFollow: steps after step 1, never an Image or Video step', () => {
  assert.equal(F.canFollow('workflow', 1), true);
  assert.equal(F.canFollow('upscale', 2), true);
  assert.equal(F.canFollow('workflow', 0), false);
  assert.equal(F.canFollow('video', 1), false);
  assert.equal(F.canFollow('image', 1), false);
});

test('displayBadge hides raw node names, keeps real titles, numbers a hidden slot when there are several', () => {
  assert.equal(F.displayBadge('Load Checkpoint', 'checkpoint', 0, 1), undefined);
  assert.equal(F.displayBadge('CheckpointLoaderSimple', 'checkpoint', 0, 1), undefined);
  assert.equal(F.displayBadge('LoraLoaderModelOnly', 'lora', 1, 3), '#2');
  assert.equal(F.displayBadge('Load LoRA', 'lora', 0, 2), '#1');
  assert.equal(F.displayBadge('Style LoRA', 'lora', 0, 2), 'Style LoRA');
  assert.equal(F.displayBadge('Base', 'checkpoint', 0, 2), 'Base');
  assert.equal(F.displayBadge('Load VAE', 'vae', 0, 1), undefined);
  assert.equal(F.displayBadge(undefined, 'vae', 0, 1), undefined);
});

test('fixed slots: slot i takes source i, strengths follow, extra slots stay, off sources skipped', () => {
  const ops = F.followOps('lora', [s('a.safetensors', { weight: 0.7 }), s('off.safetensors', { on: false }), s('b.safetensors')],
    [t('1', 'x.safetensors'), t('2', 'b.safetensors', { weight: 0.5 }), t('3', 'keep.safetensors')], FIXED);
  assert.deepEqual(ops, [
    { op: 'rename', id: '1', name: 'a.safetensors' },
    { op: 'setWeight', id: '1', weight: 0.7 },
    { op: 'setWeight', id: '2', weight: 1 },
  ]);
});

test('un-linked entries are never touched and not counted', () => {
  const ops = F.followOps('checkpoint', [s('sdxl/base.safetensors')], [t('c', 'mine.safetensors', { linked: false })], { ...FIXED, syncWeight: false });
  assert.deepEqual(ops, []);
  const ops2 = F.followOps('lora', [s('a'), s('b')], [t('1', 'mine', { linked: false }), t('2', 'z')], FIXED);
  assert.deepEqual(ops2, [{ op: 'rename', id: '2', name: 'a' }]);
});

test('same file by base name: no rename when only the folder differs', () => {
  assert.deepEqual(F.followOps('checkpoint', [s('SDXL/m.safetensors')], [t('c', 'm.safetensors')], { ...FIXED, syncWeight: false }), []);
});

test('empty source leaves fixed slots alone', () => {
  assert.deepEqual(F.followOps('vae', [], [t('v', 'x.vae')], FIXED), []);
});

test('growable kinds: the linked set becomes the source set (rename a stray, add, remove), switches follow', () => {
  const ops = F.followOps('lora', [s('a', { on: false }), s('b'), s('c')], [t('1', 'a'), t('2', 'z'), t('3', 'mine', { linked: false })], GROW);
  assert.deepEqual(ops, [
    { op: 'setOn', id: '1', on: false },
    { op: 'rename', id: '2', name: 'b' },
    { op: 'add', name: 'c', on: true, weight: 1 },
  ]);
  assert.deepEqual(F.followOps('lora', [], [t('1', 'a'), t('2', 'b', { linked: false })], GROW), [{ op: 'remove', id: '1' }]);
});

test('applying the ops yields nothing more (idempotent)', () => {
  const source = [s('a', { weight: 0.6 }), s('b')];
  let entries = [t('1', 'x'), t('2', 'b', { weight: 0.2 })];
  for (const op of F.followOps('lora', source, entries, FIXED)) {
    entries = entries.map((e) => (e.id !== op.id ? e : op.op === 'rename' ? { ...e, name: op.name } : op.op === 'setWeight' ? { ...e, weight: op.weight } : e));
  }
  assert.deepEqual(F.followOps('lora', source, entries, FIXED), []);
});

test('fixedExpect: what each linked fixed slot should hold', () => {
  assert.deepEqual(F.fixedExpect([s('a'), s('off', { on: false }), s('b')], [t('1', 'x'), t('2', 'y', { linked: false }), t('3', 'z')], FIXED), { 1: 'a', 3: 'b' });
  assert.deepEqual(F.fixedExpect([s('a')], [t('1', 'x')], GROW), {});
});

test('sourceKey changes only when step 1 really changes', () => {
  assert.equal(F.sourceKey([s('A/b.safetensors')]), F.sourceKey([s('b.safetensors')]));
  assert.notEqual(F.sourceKey([s('b')]), F.sourceKey([s('b', { weight: 0.5 })]));
});
