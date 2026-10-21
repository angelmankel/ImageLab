const { test } = require('node:test');
const assert = require('node:assert/strict');
const N = require('./_load.cjs')('src/app/notifyLogic.ts');

test('network failures read as a plain sentence, raw text kept', () => {
  const r = N.humanError(new TypeError('Failed to fetch'));
  assert.equal(r.text, 'Could not reach the server. Is it running?');
  assert.equal(r.detail, 'Failed to fetch');
});

test('missing model / node', () => {
  assert.match(N.humanError('Prompt outputs failed validation: value_not_in_list: ckpt_name').text, /model or file is missing/);
  assert.match(N.humanError('Node type FooBar does not exist').text, /node is missing/);
});

test('short plain text stays as is, no details', () => {
  assert.deepEqual(N.humanError('No video server'), { text: 'No video server', detail: '' });
});

test('long or code-ish text → generic sentence + details', () => {
  const raw = 'Error: {"error":{"type":"x","message":"y"},"node_errors":{}}';
  const r = N.humanError(raw);
  assert.equal(r.text, 'Something went wrong.');
  assert.equal(r.detail, raw);
});

test('nothing → empty', () => {
  assert.deepEqual(N.humanError(undefined), { text: '', detail: '' });
});
