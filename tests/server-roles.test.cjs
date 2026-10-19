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
  vm.runInNewContext(code, { exports, Math });
  return exports;
}
const r = load('serverRoles');

const pod = { id: 'a', name: 'This pod', host: 'pod:8188' };
const vid = { id: 'b', name: 'This pod · video', host: 'pod:8188/video-comfy' };
const lan = { id: 'c', name: 'LAN', host: 'comfy.lan', enabled: false };

test('a /video-comfy path is the video server unless told otherwise', () => {
  assert.equal(r.serverRole(pod), 'both');
  assert.equal(r.serverRole(vid), 'video');
  assert.equal(r.serverRole({ ...vid, role: 'both' }), 'both');
  assert.equal(r.hostPath('pod:8188/video-comfy/'), '/video-comfy/');
  assert.equal(r.hostPath('pod:8188'), '');
});

test('video goes to the video server, images stay off it', () => {
  assert.deepEqual([...r.serversForMode([pod, vid, lan], 'video').map(s => s.id)], ['b']);
  assert.deepEqual([...r.serversForMode([pod, vid, lan], 'image').map(s => s.id)], ['a']);
  assert.deepEqual([...r.serversForMode([pod, vid], 'workflow').map(s => s.id)], ['a']);
});

test('one server runs both modes; a video-only box still takes images when alone', () => {
  assert.deepEqual([...r.serversForMode([pod], 'video').map(s => s.id)], ['a']);
  assert.deepEqual([...r.serversForMode([vid], 'image').map(s => s.id)], ['b']);
  assert.deepEqual(r.serversForMode([{ ...pod, role: 'image' }], 'video'), []);
});

test('the pinned server wins only when it fits the mode', () => {
  assert.equal(r.pickServerForMode([pod, vid], 'video', 'a').id, 'b');
  assert.equal(r.pickServerForMode([pod, vid], 'image', 'a').id, 'a');
  assert.equal(r.pickServerForMode([pod, { ...vid, role: 'both' }], 'image', 'b').id, 'b');
  assert.equal(r.pickServerForMode([], 'image', null), null);
});

test('the pod video server is added once when present, and a moved one is replaced', () => {
  const make = (host) => ({ id: 'n', name: 'This pod · video', host, role: 'video' });
  const added = r.withVideoServer([pod], 'pod:8188', true, make);
  assert.deepEqual([...added.map(s => s.host)], ['pod:8188', 'pod:8188/video-comfy']);
  const again = r.withVideoServer(added, 'pod:8188', true, make);
  assert.equal(again.length, 2);
  const moved = r.withVideoServer([pod, { ...added[1], host: 'old:1/video-comfy' }], 'pod:8188', true, make);
  assert.deepEqual([...moved.map(s => s.host)], ['pod:8188', 'pod:8188/video-comfy']);
  const absent = r.withVideoServer([pod, { ...added[1], host: 'old:1/video-comfy' }], 'pod:8188', false, make);
  assert.deepEqual([...absent.map(s => s.host)], ['pod:8188']);
  assert.equal(r.withVideoServer([pod], 'pod:8188', false, make).length, 1);
});
