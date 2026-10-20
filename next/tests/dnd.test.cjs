const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const P = load('src/dnd/payload.ts');

const dt = (data, files = [], types) => ({ types: types ?? [...Object.keys(data), ...(files.length ? ['Files'] : [])], getData: (t) => data[t] ?? '', files });

test('payload round-trips and old {url,name} still decodes', () => {
  const p = P.makePayload({ url: 'https://h/view?filename=a.png', name: 'a.png', source: 'history', key: 'k1' });
  assert.equal(p.v, 1); assert.equal(p.kind, 'image');
  assert.deepEqual(P.decodePayload(P.encodePayload(p)), p);
  assert.deepEqual(P.decodePayload('{"url":"https://h/x.mp4","name":"x.mp4"}'), { v: 1, url: 'https://h/x.mp4', name: 'x.mp4', kind: 'image' });
  assert.equal(P.decodePayload('nope'), null);
  assert.equal(P.decodePayload('{}'), null);
  assert.equal(P.makePayload({ url: 'u', name: 'clip.mp4' }).kind, 'video');
});

test('nameFromUrl: the /view filename, a path segment, a fallback', () => {
  assert.equal(P.nameFromUrl('https://h/view?filename=out_0001.png&type=output'), 'out_0001.png');
  assert.equal(P.nameFromUrl('https://image.civitai.com/xyz/width=450/12345.jpeg'), '12345.jpeg');
  assert.equal(P.nameFromUrl('https://image.civitai.com/xyz/width=450'), 'width=450.png');
  assert.equal(P.nameFromUrl('data:image/png;base64,abc'), 'image.png');
});

test('readDrop: our payload wins, then files, then uri-list / html / plain', () => {
  const our = P.readDrop(dt({ [P.MIME]: JSON.stringify({ url: 'https://h/a.png', name: 'a.png' }), 'text/uri-list': 'https://h/a.png' }));
  assert.equal(our.kind, 'url'); assert.equal(our.payload.name, 'a.png');
  const file = { name: 'pic.jpg', type: 'image/jpeg' };
  const f = P.readDrop(dt({ 'text/plain': 'junk' }, [{ name: 'notes.txt', type: 'text/plain' }, file]));
  assert.equal(f.kind, 'file'); assert.equal(f.file, file);
  const u = P.readDrop(dt({ 'text/uri-list': '# comment\r\nhttps://site/x.webp\r\n' }));
  assert.deepEqual(u, { kind: 'url', url: 'https://site/x.webp', name: 'x.webp', payload: null });
  const h = P.readDrop(dt({ 'text/html': '<meta charset="utf-8"><img alt="" src="https://cdn/y.png?w=1&amp;h=2">' }));
  assert.equal(h.url, 'https://cdn/y.png?w=1&h=2');
  const t = P.readDrop(dt({ 'text/plain': 'https://cdn/z.png' }));
  assert.equal(t.url, 'https://cdn/z.png');
  assert.equal(P.readDrop(dt({ 'text/plain': 'hello' })), null);
  assert.equal(P.readDrop(null), null);
});

test('mayCarryImage looks at the types alone', () => {
  assert.equal(P.mayCarryImage(['Files']), true);
  assert.equal(P.mayCarryImage(['text/html', 'text/plain']), true);
  assert.equal(P.mayCarryImage(['text/plain']), false);
  assert.equal(P.mayCarryImage(null), false);
});
