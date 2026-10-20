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
  vm.runInNewContext(code, { exports, Math, Set });
  return exports;
}
const m = load('promptMine');
const ids = (l) => Array.from(l, x => x.id);

const p = (id, kind, positive, extra = {}) => ({ id, kind, name: m.nameFor(positive), positive, createdAt: Number(id.replace(/\D/g, '')) || 0, ...extra });

test('nameFor takes the first words', () => {
  assert.equal(m.nameFor('a cat in a window at night'), 'a cat in a window…');
  assert.equal(m.nameFor('  short  '), 'short');
});

test('add is newest first and never twice', () => {
  let list = m.addMine([], p('1', 'image', 'a castle'));
  list = m.addMine(list, p('2', 'image', 'a dragon'));
  assert.deepEqual(ids(list), ['2', '1']);
  list = m.addMine(list, p('3', 'image', ' a castle '));
  assert.deepEqual(ids(list), ['2', '1']);
  list = m.addMine(list, p('4', 'video', 'a castle'));
  assert.deepEqual(ids(list), ['4', '2', '1']);
  assert.equal(m.addMine(list, p('5', 'image', '   ')).length, 3);
  assert.ok(m.hasMine(list, { kind: 'image', positive: 'a dragon' }));
  assert.ok(!m.hasMine(list, { kind: 'image', positive: 'a dragon', negative: 'blurry' }));
  assert.deepEqual(ids(m.removeMine(list, '2')), ['4', '1']);
});

test('filterMine keeps one kind, matches words, newest first', () => {
  const list = [p('1', 'image', 'a castle on a hill'), p('3', 'image', 'a dragon in the sky', { theme: 'fantasy' }), p('2', 'video', 'the camera orbits a castle')];
  assert.deepEqual(ids(m.filterMine(list, 'image')), ['3', '1']);
  assert.deepEqual(ids(m.filterMine(list, 'video')), ['2']);
  assert.deepEqual(ids(m.filterMine(list, 'image', 'fantasy')), ['3']);
  assert.deepEqual(ids(m.filterMine(list, 'image', 'castle hill')), ['1']);
});

test('parsePromptSet strips numbering, bullets, quotes and labels', () => {
  const raw = [
    '1. "A fox in the snow, soft morning light"',
    '2) A fox in the snow, soft morning light',
    '- Prompt 3: An owl on a branch, moonlit forest',
    '',
    '• ok',
    '* "Tiny fairy sitting on a mushroom, dew drops"',
    'Prompt: A whale swimming through clouds',
  ].join('\n');
  assert.deepEqual([...m.parsePromptSet(raw)], [
    'A fox in the snow, soft morning light',
    'An owl on a branch, moonlit forest',
    'Tiny fairy sitting on a mushroom, dew drops',
    'A whale swimming through clouds',
  ]);
  assert.equal(m.parsePromptSet(raw, 2).length, 2);
});
