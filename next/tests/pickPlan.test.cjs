// Change on a model slot replaces that entry in place, never appends (fix list 2, added item).
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const P = load('src/screens/image/model/pickPlan.ts');

const loras = [
  { id: 'a', name: 'one.safetensors', weight: 0.8 },
  { id: 'b', name: 'two.safetensors', weight: 0.6 },
  { id: 'c', name: 'three.safetensors', weight: 1 },
];

test('Change on LoRA 2 of 3 keeps 3 LoRAs: #2 swapped in place with its strength, #1 / #3 untouched', () => {
  const plan = P.planPick({ mode: 'change', id: 'b' }, { installed: true, file: 'new.safetensors' }, loras);
  assert.deepEqual(plan, { op: 'rename', id: 'b', file: 'new.safetensors' });
  const after = P.renameIn(loras, plan.id, plan.file);
  assert.equal(after.length, 3);
  assert.deepEqual(after[0], loras[0]);
  assert.deepEqual(after[1], { id: 'b', name: 'new.safetensors', weight: 0.6 });
  assert.deepEqual(after[2], loras[2]);
});

test('Change never adds: a file the list already has, or one still to download, still targets that entry', () => {
  assert.deepEqual(P.planPick({ mode: 'change', id: 'b' }, { installed: true, file: 'three.safetensors' }, loras), { op: 'rename', id: 'b', file: 'three.safetensors' });
  assert.deepEqual(P.planPick({ mode: 'change', id: 'a' }, { installed: false, file: null }, loras), { op: 'change-pending', id: 'a' });
  assert.deepEqual(P.planPick({ mode: 'change', id: 'gone' }, { installed: true, file: 'x' }, loras), { op: 'none' });
});

test('Only Add adds; adding a file that is already there selects it', () => {
  assert.deepEqual(P.planPick({ mode: 'add' }, { installed: true, file: 'x.safetensors' }, loras), { op: 'add', file: 'x.safetensors' });
  assert.deepEqual(P.planPick({ mode: 'add' }, { installed: true, file: 'two.safetensors' }, loras), { op: 'select', id: 'b' });
  assert.deepEqual(P.planPick({ mode: 'add' }, { installed: false, file: null }, loras), { op: 'add-pending' });
});
