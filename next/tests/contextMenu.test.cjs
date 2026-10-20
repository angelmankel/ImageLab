// The right-click menu's pure layer (src/app/contextMenu/menuLogic.ts): rows from registered
// entries (visible / enabled rules, order, groups → separators, submenus), keyboard walking, placement.
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');
const L = load('src/app/contextMenu/menuLogic.ts');

const labels = (rows) => rows.map((r) => (r.kind === 'sep' ? '|' : r.label));

test('hidden rows drop, order sorts, groups get one separator between them', () => {
  const rows = L.resolveRows([
    { id: 'a', label: 'A', group: 'one' },
    { id: 'b', label: 'B', group: 'two' },
    { id: 'c', label: 'C', group: 'one', order: -1 },
    { id: 'h', label: 'H', visible: () => false },
  ], {});
  assert.deepEqual(labels(rows), ['C', 'A', '|', 'B']);
});

test('labels and rules read the target; a throwing rule hides the row, never the menu', () => {
  const rows = L.resolveRows([
    { id: 'n', label: (t) => `Rename ${t.name}` },
    { id: 'd', label: 'Delete', enabled: (t) => t.count > 1 || 'The last one stays' },
    { id: 'x', label: 'X', visible: () => { throw new Error('boom'); } },
    { id: 'k', label: 'K', checked: (t) => t.on },
  ], { name: 'Step 1', count: 1, on: true });
  assert.deepEqual(labels(rows), ['Rename Step 1', 'Delete', 'K']);
  assert.equal(rows[1].disabled, true);
  assert.equal(rows[1].reason, 'The last one stays');
  assert.equal(rows[2].checked, true);
});

test('submenus resolve; an empty submenu is not shown', () => {
  const rows = L.resolveRows([
    { id: 's', label: 'Send to', submenu: (t) => t.steps.map((s) => ({ id: s, label: s })) },
    { id: 'e', label: 'Empty', submenu: [{ id: 'z', label: 'Z', visible: () => false }] },
  ], { steps: ['Image', 'Upscale'] });
  assert.deepEqual(labels(rows), ['Send to']);
  assert.deepEqual(labels(rows[0].children), ['Image', 'Upscale']);
});

test('keyboard walk skips separators and disabled rows, and wraps', () => {
  const rows = L.resolveRows([
    { id: 'a', label: 'Alpha', group: '1' },
    { id: 'b', label: 'Beta', group: '1', enabled: () => false },
    { id: 'c', label: 'Charlie', group: '2' },
  ], {});
  // rows: Alpha, Beta(disabled), |, Charlie
  assert.equal(L.firstIndex(rows), 0);
  assert.equal(L.stepIndex(rows, 0, 1), 3);
  assert.equal(L.stepIndex(rows, 3, 1), 0);
  assert.equal(L.stepIndex(rows, 0, -1), 3);
  assert.equal(L.lastIndex(rows), 3);
  assert.equal(L.letterIndex(rows, 0, 'c'), 3);
  assert.equal(L.letterIndex(rows, 0, 'b'), -1);
  assert.equal(L.stepIndex([], -1, 1), -1);
});

test('placement stays inside the window', () => {
  assert.deepEqual(L.placeAtPoint(100, 100, 200, 300, 1000, 800), { left: 102, top: 102 });
  const p = L.placeAtPoint(950, 700, 200, 300, 1000, 800); // flips left and up
  assert.ok(p.left + 200 <= 992 && p.top + 300 <= 792 && p.left >= 8 && p.top >= 8);
  const s = L.placeBeside({ left: 800, right: 990, top: 100 }, 200, 100, 1000, 800); // no room right
  assert.equal(s.left, 602);
  assert.equal(L.placeBeside({ left: 10, right: 200, top: 100 }, 200, 100, 1000, 800).left, 198);
});
