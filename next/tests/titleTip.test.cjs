// Item 20: the title bridge's placement (src/ui/titleTipLogic.ts): above and centred, flips below
// at the top edge, never leaves the window.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const { placeTip, TIP_GAP, TIP_EDGE } = load('src/ui/titleTipLogic.ts');
const view = { width: 1000, height: 800 };

test('centred above the anchor', () => {
  const p = placeTip({ left: 400, top: 300, width: 40, height: 20 }, { width: 100, height: 24 }, view);
  assert.deepEqual(p, { left: 370, top: 300 - TIP_GAP - 24, side: 'top' });
});
test('no room above → below', () => {
  const p = placeTip({ left: 400, top: 4, width: 40, height: 20 }, { width: 100, height: 24 }, view);
  assert.equal(p.side, 'bottom');
  assert.equal(p.top, 4 + 20 + TIP_GAP);
});
test('clamped inside the window at both sides', () => {
  assert.equal(placeTip({ left: 0, top: 300, width: 10, height: 10 }, { width: 200, height: 24 }, view).left, TIP_EDGE);
  assert.equal(placeTip({ left: 990, top: 300, width: 10, height: 10 }, { width: 200, height: 24 }, view).left, 1000 - TIP_EDGE - 200);
});
