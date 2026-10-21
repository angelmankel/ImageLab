// FIXLIST-2 #52: the ComfyUI screen's server picker rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const P = load('src/screens/comfy/serverPickLogic.ts');

test('kind follows the role; both keeps the current kind', () => {
  assert.equal(P.kindForRole('video', 'image'), 'video');
  assert.equal(P.kindForRole('image', 'video'), 'image');
  assert.equal(P.kindForRole('both', 'video'), 'video');
});

test('chosen server must exist and be on', () => {
  const list = [{ id: 'a' }, { id: 'b', enabled: false }];
  assert.equal(P.chosenServer(list, 'a').id, 'a');
  assert.equal(P.chosenServer(list, 'b'), null);
  assert.equal(P.chosenServer(list, 'zz'), null);
  assert.equal(P.chosenServer(list, null), null);
});

test('title and second line', () => {
  assert.equal(P.pickerTitle('This pod', 'RTX A4500'), 'This pod · RTX A4500');
  assert.equal(P.pickerTitle('winold', null), 'winold');
  assert.equal(P.pickerLine({ role: 'image', online: true, vram: '1.1 / 20.0 GB', queued: 0, host: 'h' }), 'Images · VRAM 1.1 / 20.0 GB · idle');
  assert.equal(P.pickerLine({ role: 'video', online: true, vram: '', queued: 2, host: 'h' }), 'Video · 2 on the server');
  assert.equal(P.pickerLine({ role: 'both', online: false, vram: '', queued: 0, host: '1.2.3.4:8188' }), 'Offline · 1.2.3.4:8188');
  assert.equal(P.pickerLine({ role: 'both', online: null, vram: '', queued: 0, host: 'h' }), 'Images + video · checking…');
  assert.equal(P.pickerLine({ role: 'image', online: true, vram: '', queued: 0, host: 'h', paused: true }), 'Paused · h');
});
