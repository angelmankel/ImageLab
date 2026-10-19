const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
// As tests/swipe.test.cjs, plus a `require` so `pager` can pull its constants from `swipe`.
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = (spec) => load(spec.replace(/^(\.\/|@\/lib\/)/, ''));
  vm.runInNewContext(code, { exports, require, Math });
  return exports;
}
const p = load('pager');

test('the index clamps to the list', () => {
  assert.equal(p.clampIndex(-3, 5), 0);
  assert.equal(p.clampIndex(7, 5), 4);
  assert.equal(p.clampIndex(2, 5), 2);
  assert.equal(p.clampIndex(0, 0), -1);
});

test('rubber-banding follows less and less and never passes its limit', () => {
  const w = 390;
  assert.equal(p.rubberBand(0, w), 0);
  assert.ok(p.rubberBand(50, w) < 50 && p.rubberBand(50, w) > 20); // about half
  assert.ok(p.rubberBand(200, w) < p.rubberBand(300, w));
  assert.ok(p.rubberBand(5000, w) < w);
  assert.equal(p.rubberBand(-100, w), -p.rubberBand(100, w));
});

test('the track follows 1:1 inside the list and resists at the ends', () => {
  assert.equal(p.dragOffset(-120, 1, 5, 390), -120);
  assert.equal(p.dragOffset(120, 1, 5, 390), 120);
  assert.ok(p.dragOffset(120, 0, 5, 390) < 120);   // first item, pulling for a previous one
  assert.ok(p.dragOffset(-120, 4, 5, 390) > -120); // last item, pulling for a next one
  assert.equal(p.dragOffset(-120, 0, 5, 390), -120);
});

test('the axis locks either way once the finger has moved', () => {
  assert.equal(p.lockAxis(3, 3), null);
  assert.equal(p.lockAxis(30, 10), 'x');
  assert.equal(p.lockAxis(-30, 10), 'x');
  assert.equal(p.lockAxis(10, 30), 'y');
});

test('a release pages on distance or on a flick, never past an end', () => {
  const w = 390;
  assert.equal(p.pageOnRelease(-150, 0, w, 2, 5), 3);   // far enough
  assert.equal(p.pageOnRelease(-100, 0, w, 2, 5), 2);   // short and slow: back
  assert.equal(p.pageOnRelease(-40, -0.9, w, 2, 5), 3); // quick flick
  assert.equal(p.pageOnRelease(-10, -0.9, w, 2, 5), 2); // too short even if quick
  assert.equal(p.pageOnRelease(-40, 0.9, w, 2, 5), 2);  // moving back the other way on release
  assert.equal(p.pageOnRelease(150, 0, w, 2, 5), 1);
  assert.equal(p.pageOnRelease(150, 0, w, 0, 5), 0);    // no previous
  assert.equal(p.pageOnRelease(-150, 0, w, 4, 5), 4);   // no next
  assert.equal(p.pageOnRelease(-150, 0, w, 0, 1), 0);
});

test('pull-down progress, scale and the close decision', () => {
  const h = 800;
  assert.equal(p.closeProgress(0, h), 0);
  assert.equal(p.closeProgress(-50, h), 0);
  assert.ok(p.closeProgress(100, h) > 0 && p.closeProgress(100, h) < 1);
  assert.equal(p.closeProgress(2000, h), 1);
  assert.equal(p.closeScale(0), 1);
  assert.ok(p.closeScale(1) < 1 && p.closeScale(1) > 0.5);
  assert.ok(p.closeCommits(200, 0, h));          // a fifth of the height
  assert.ok(!p.closeCommits(100, 0, h));         // short and slow
  assert.ok(p.closeCommits(40, 1.2, h));         // flick
  assert.ok(!p.closeCommits(10, 1.2, h));        // a twitch
  assert.ok(!p.closeCommits(-200, -2, h));       // upwards never closes
});

test('the spring settles in about 300 ms, overshoots only when thrown', () => {
  const rest = p.spring(300, 0);
  assert.equal(rest(0).x, 300);
  assert.ok(rest(150).x < 150 && rest(150).x > 0);
  assert.ok(Math.abs(rest(300).x) < 6);
  assert.ok(rest(450).done);
  // From rest it never visibly crosses zero (under a pixel).
  for (let t = 0; t <= 600; t += 10) assert.ok(rest(t).x >= -1, `t=${t}`);
  // Thrown past the target it overshoots, then comes back.
  const thrown = p.spring(100, -2);
  const xs = [];
  for (let t = 0; t <= 600; t += 10) xs.push(thrown(t).x);
  assert.ok(Math.min(...xs) < 0);
  assert.ok(thrown(600).done);
  // A critically damped pair also settles.
  const crit = p.spring(200, 0, { stiffness: 100, damping: 40 });
  assert.ok(crit(0).x === 200 && crit(1000).done);
});

test('the wheel steps once per gesture, then waits for quiet', () => {
  const s = p.createWheelStepper(60, 160);
  assert.equal(s.feed(20, 0), 0);
  assert.equal(s.feed(20, 16), 0);
  assert.equal(s.feed(30, 32), 1);        // past the threshold
  assert.equal(s.feed(100, 48), 0);       // inertia: swallowed
  assert.equal(s.feed(100, 100), 0);
  assert.equal(s.feed(-80, 400), -1);     // quiet long enough: a new gesture
  assert.equal(s.feed(-5, 1000), 0);      // a small nudge is not a step
});

test('a thumbnail is centred in the strip', () => {
  assert.equal(p.centredScrollLeft(400, 72, 390), 400 + 36 - 195);
  assert.equal(p.centredScrollLeft(10, 72, 390), 0);
});

const f = load('flip');

test('the painted rect under contain and cover', () => {
  const box = { x: 10, y: 20, w: 200, h: 100 };
  assert.deepEqual({ ...f.fitRect({ w: 100, h: 100 }, box) }, { x: 60, y: 20, w: 100, h: 100 });
  assert.deepEqual({ ...f.fitRect({ w: 100, h: 100 }, box, 'cover') }, { x: 10, y: -30, w: 200, h: 200 });
  assert.deepEqual({ ...f.fitRect(null, box) }, box);
  assert.deepEqual({ ...f.fitRect({ w: 0, h: 0 }, box) }, box);
});

test('the flip transform lays the fullscreen copy over its thumbnail', () => {
  const to = { x: 0, y: 100, w: 400, h: 600 };     // the picture in the viewer
  const from = { x: 20, y: 30, w: 80, h: 120 };     // the thumbnail
  const t = f.flipFrom(from, to);
  assert.equal(t.sx, 0.2);
  assert.equal(t.sy, 0.2);
  // The top-left of `to` lands on the top-left of `from`.
  assert.equal(to.x * t.sx + t.x, from.x);
  assert.equal(to.y * t.sy + t.y, from.y);
  assert.equal(f.flipTransform(t), 'translate(20px, 10px) scale(0.2, 0.2)');
  assert.deepEqual({ ...f.flipFrom(from, { x: 0, y: 0, w: 0, h: 0 }) }, { x: 0, y: 0, sx: 1, sy: 1 });
});

test('an origin counts only when it is on screen', () => {
  const vp = { w: 390, h: 800 };
  assert.ok(f.visibleRect({ x: 10, y: 10, w: 100, h: 100 }, vp));
  assert.ok(!f.visibleRect({ x: 10, y: 10, w: 0, h: 0 }, vp));     // display: none
  assert.ok(!f.visibleRect({ x: 500, y: 10, w: 100, h: 100 }, vp)); // off to the right
  assert.ok(!f.visibleRect({ x: 10, y: -200, w: 100, h: 100 }, vp)); // scrolled above
});
