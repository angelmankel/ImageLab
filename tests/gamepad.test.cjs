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
  vm.runInNewContext(code, { exports, Math, Number, Set, Infinity });
  return exports;
}
const g = load('gamepad');

const keys = (r) => [...r.keys].sort();
const pad = (id, mapping, pressed = [], axes = [0, 0, 0, 0], count = 18) => ({
  id, mapping, axes,
  buttons: Array.from({ length: count }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
});

test('pads are told apart by id, as Chrome desktop and Android name them', () => {
  assert.equal(g.padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
  assert.equal(g.padFamily('Pro Controller'), 'nintendo'); // Android: just the name
  assert.equal(g.padFamily('Nintendo Switch Pro Controller'), 'nintendo');
  assert.equal(g.padFamily('Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)'), 'nintendo');
  assert.equal(g.padFamily('Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)'), 'joycon-r');
  assert.equal(g.padFamily('Joy-Con (L)'), 'joycon-l');
  assert.equal(g.padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation');
  assert.equal(g.padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(g.padFamily('8BitDo SN30 Pro'), 'xbox');
});

test('a Switch pad confirms with the button printed A, which sits on the right', () => {
  const desktop = { android: false, partner: false };
  // Standard index 1 is the right face button: on a Pro Controller that is A.
  assert.deepEqual(keys(g.readPad(pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [1]), desktop)), ['a']);
  assert.deepEqual(keys(g.readPad(pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [0]), desktop)), ['b']);
  assert.deepEqual(keys(g.readPad(pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [3, 2]), desktop)), ['x', 'y']);
  // An Xbox pad confirms on the bottom one, and its left button is X.
  assert.deepEqual(keys(g.readPad(pad('Xbox Wireless Controller', 'standard', [0]), desktop)), ['a']);
  assert.deepEqual(keys(g.readPad(pad('Xbox Wireless Controller', 'standard', [2]), desktop)), ['x']);
  // Android reports the Pro Controller unmapped, with the same positional indices.
  assert.deepEqual(keys(g.readPad(pad('Pro Controller', '', [1, 9, 8]), { android: true, partner: false })), ['a', 'minus', 'plus']);
});

test('analog triggers count from half way, and shoulders and sticks map through', () => {
  const p = pad('Pro Controller', 'standard', [4, 10, 12]);
  p.buttons[7] = { pressed: false, value: 0.7 };
  p.buttons[6] = { pressed: false, value: 0.3 };
  assert.deepEqual(keys(g.readPad(p, { android: false, partner: false })), ['l', 'lstick', 'up', 'zr']);
});

test('a lone Joy-Con on Android is turned sideways by hand', () => {
  const ctx = { android: true, partner: false };
  // Joy-Con R upright: 1 is A (east). Sideways A is at the bottom, so it goes back; X is now right.
  assert.deepEqual(keys(g.readPad(pad('Joy-Con (R)', '', [1]), ctx)), ['b']);
  assert.deepEqual(keys(g.readPad(pad('Joy-Con (R)', '', [2]), ctx)), ['a']); // X on BUTTON_X (Generic.kl)
  assert.deepEqual(keys(g.readPad(pad('Joy-Con (R)', '', [4, 6]), ctx)), ['l', 'r']); // SL, SR
  assert.deepEqual(keys(g.readPad(pad('Joy-Con (R)', '', [5, 9]), ctx)), ['minus', 'plus']); // R, +
  // Its stick is the right stick; pushed away from you (the Joy-Con's left) is up.
  const r = g.readPad(pad('Joy-Con (R)', '', [], [0, 0, -1, 0]), ctx);
  assert.equal(r.move.y, -1);
  assert.equal(r.move.x === 0, true);
  const l = g.readPad(pad('Joy-Con (L)', '', [], [1, 0, 0, 0]), ctx);
  assert.equal(l.move.y, -1);
  assert.deepEqual(keys(g.readPad(pad('Joy-Con (L)', '', [13]), ctx)), ['a']); // its down arrow sits on the right
});

test('on desktop Chrome a lone Joy-Con is already sideways, so its indices are read as they come', () => {
  const r = g.readPad(pad('Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)', 'standard', [1]), { android: false, partner: false });
  assert.equal(r.family, 'joycon-r');
  assert.deepEqual(keys(r), ['a']);
});

test('a Joy-Con pair on Android is one upright pad, and a press on both fires once', () => {
  const both = g.readPads([
    pad('Joy-Con (L)', '', [4], [0, 1, 0, 0]),
    pad('Joy-Con (R)', '', [1, 3], [0, 0, 0, 0.8]),
  ], true);
  assert.deepEqual([...both.keys].sort(), ['a', 'l', 'y']); // R's 3 is Y on BUTTON_Y; L's L stays L
  assert.equal(both.move.y, 1);
  assert.equal(both.scroll.y, 0.8);
  assert.equal(both.readings[0].family, 'nintendo');
  const twice = g.readPads([pad('Pro Controller', 'standard', [1]), pad('Pro Controller', 'standard', [1])], false);
  assert.deepEqual([...twice.keys], ['a']);
});

test('labels follow what is printed on the pad', () => {
  assert.equal(g.padLabels('nintendo').a, 'A');
  assert.equal(g.padLabels('nintendo').minus, '−');
  assert.equal(g.padLabels('joycon-r').a, 'X');
  assert.equal(g.padLabels('joycon-r').zl, '');
  assert.equal(g.padLabels('playstation').a, '✕');
  assert.equal(g.padLabels('xbox').l, 'LB');
});

test('a stick reads as directions past its dead zone', () => {
  assert.deepEqual([...g.stickDirs({ x: 0.2, y: -0.9 })], ['up']);
  assert.deepEqual([...g.stickDirs({ x: -0.8, y: 0.8 })], ['left', 'down']);
  assert.deepEqual([...g.stickDirs({ x: 0.4, y: 0.4 })], []);
});

const box = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });

test('moving keeps to the column and the row', () => {
  // A desktop: a settings column on the left, the result strip in the middle.
  const boxes = [
    box(0, 0, 300, 40),    // 0 card
    box(0, 60, 300, 40),   // 1 card
    box(320, 70, 60, 60),  // 2 strip thumb, slightly below card 0 but off to the side
    box(0, 400, 300, 50),  // 3 Generate
    box(390, 70, 60, 60),  // 4 next thumb
  ];
  assert.equal(g.pickInDirection(boxes, boxes[0], 'down', 0), 1);
  assert.equal(g.pickInDirection(boxes, boxes[1], 'down', 1), 3);
  assert.equal(g.pickInDirection(boxes, boxes[3], 'up', 3), 1);
  assert.equal(g.pickInDirection(boxes, boxes[1], 'right', 1), 2);
  assert.equal(g.pickInDirection(boxes, boxes[2], 'right', 2), 4);
  assert.equal(g.pickInDirection(boxes, boxes[2], 'left', 2), 1);
  assert.equal(g.pickInDirection(boxes, boxes[0], 'up', 0), -1);
});

test('a row of small buttons under a wide box: down lands on the one in line', () => {
  const boxes = [box(0, 0, 400, 100), box(0, 120, 40, 30), box(180, 120, 40, 30), box(360, 120, 40, 30)];
  assert.equal(g.pickInDirection(boxes, box(170, 0, 60, 100), 'down', -1), 2);
  assert.equal(g.pickInDirection(boxes, boxes[0], 'down', 0), 2); // all overlap: the centred one
});

test('picking up again and starting', () => {
  const boxes = [box(0, 100, 50, 20), box(100, 8, 50, 20), box(10, 10, 50, 20)];
  assert.equal(g.firstBox(boxes), 2); // top row within slack, then leftmost
  assert.equal(g.nearestBox(boxes, 20, 105), 0);
  assert.equal(g.firstBox([]), -1);
});

test('scrolling shows an item with a margin, and only when needed', () => {
  assert.equal(g.scrollDelta(100, 140, 0, 500), 0);
  assert.equal(g.scrollDelta(480, 520, 0, 500), 44);
  assert.equal(g.scrollDelta(-30, 10, 0, 500), -54);
  assert.equal(g.scrollDelta(100, 900, 0, 500), 100); // taller than the view: line up its start
});

test('a step stops at the ends unless it wraps', () => {
  assert.equal(g.stepIndex(0, 3, -1), 0);
  assert.equal(g.stepIndex(2, 3, 1), 2);
  assert.equal(g.stepIndex(2, 3, 1, true), 0);
  assert.equal(g.stepIndex(-1, 3, 1), 0);
  assert.equal(g.stepIndex(1, 0, 1), -1);
});
