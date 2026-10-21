// Item 39: the keyboard highlight stays visible (src/ui/scrollLogic.ts): scroll as little as possible.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const { nearestScroll } = load('src/ui/scrollLogic.ts');

test('already visible → no scroll', () => {
  assert.equal(nearestScroll(0, 300, 100, 40), null);
});
test('below the view → scrolls so its bottom (+ margin) is the view bottom', () => {
  assert.equal(nearestScroll(0, 300, 290, 40, 4), 290 + 40 + 4 - 300);
});
test('above the view → scrolls so its top (− margin) is the view top', () => {
  assert.equal(nearestScroll(200, 300, 150, 40, 4), 146);
});
test('never negative; taller than the view shows its start', () => {
  assert.equal(nearestScroll(50, 300, 2, 40, 4), 0);
  assert.equal(nearestScroll(0, 100, 500, 400, 0), 500);
});
