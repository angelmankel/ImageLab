const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/screens/image/model/promptWords.ts');

test('hasWord matches a comma part, ignoring case and weight wrappers', () => {
  assert.equal(P.hasWord('a girl, Add Detail, sharp', 'add detail'), true);
  assert.equal(P.hasWord('a girl, (add detail:1.2), sharp', 'add detail'), true);
  assert.equal(P.hasWord('a girl, [add detail], sharp', 'add detail'), true);
  assert.equal(P.hasWord('a girl with added detail', 'add detail'), false);
  assert.equal(P.hasWord('', 'x'), false);
  assert.equal(P.hasWord('x', ''), false);
});

test('addWord appends once, tidying the trailing comma', () => {
  assert.equal(P.addWord('', 'sharp'), 'sharp');
  assert.equal(P.addWord('a girl', 'sharp'), 'a girl, sharp');
  assert.equal(P.addWord('a girl, ', 'sharp'), 'a girl, sharp');
  assert.equal(P.addWord('a girl, sharp', 'Sharp'), 'a girl, sharp');
});

test('removeWord drops every matching part, weight wrappers included', () => {
  assert.equal(P.removeWord('a girl, sharp, (sharp:1.3), detailed', 'sharp'), 'a girl, detailed');
  assert.equal(P.removeWord('sharp', 'sharp'), '');
  assert.equal(P.removeWord('a girl', 'sharp'), 'a girl');
});

test('toggleWord', () => {
  assert.equal(P.toggleWord('a girl', 'sharp'), 'a girl, sharp');
  assert.equal(P.toggleWord('a girl, sharp', 'sharp'), 'a girl');
});
