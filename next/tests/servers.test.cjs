const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./_load.cjs')('src/screens/image/servers/serversLogic.ts');

const pod = { id: 'a', name: 'Pod', host: 'x', enabled: true, online: true, local: true, gpu: 'RTX A4500' };
const lan = { id: 'b', name: 'winold', host: 'y', enabled: true, online: false, local: false };

test('chip: one server names it, several count', () => {
  assert.deepEqual(L.chipOf([pod]), { label: 'This pod · RTX A4500', tone: 'ok' });
  assert.deepEqual(L.chipOf([lan]), { label: 'winold · offline', tone: 'err' });
  assert.deepEqual(L.chipOf([pod, lan]), { label: '2 servers · 1 online', tone: 'warn' });
  assert.deepEqual(L.chipOf([pod, { ...lan, enabled: false }]), { label: 'This pod · RTX A4500', tone: 'ok' });
  assert.deepEqual(L.chipOf([]), { label: 'No server', tone: 'err' });
  assert.deepEqual(L.chipOf([{ ...lan, enabled: false }]), { label: 'All servers paused', tone: 'err' });
});

test('status and preview choice', () => {
  assert.equal(L.statusOf({ enabled: false, online: true }), 'paused');
  assert.equal(L.statusOf({ enabled: true, online: false }), 'offline');
  assert.equal(L.previewChoice(1024, false), 1024);
  assert.equal(L.previewChoice(32768, true), 0);
  assert.equal(L.previewChoice(900, false), null);
  assert.equal(L.previewChoice(null, undefined), null);
});
