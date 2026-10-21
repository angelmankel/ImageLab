// FIXLIST-2 item 4 / 26: the UI scale is CSS zoom on <body>. Floating UI (every Mantine tooltip,
// popover, menu, select) only divides the zoom out when <body> is its offset parent, i.e. when the
// body is `position: relative`; viewport units must go through vw() / vh() / dvh(); hand-placed
// fixed menus convert window px with toCssPx(). These tests pin each of those rules, and scan the
// source so a raw `92vh` or a `fixed` floating strategy cannot sneak back in.
// (Checked in real Chrome 152 against @floating-ui/dom 1.8 at 90 / 100 / 110 / 125 %: with the
// relative body the tooltip centre matches the anchor centre exactly; without it it drifts by
// (zoom - 1) × distance from the window's corner.)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./_load.cjs');
const S = load('src/theme/uiScale.ts');

test('100%: the body wears nothing', () => {
  assert.deepEqual(S.bodyScaleStyle(1, 1600, 900), { zoom: null, width: null, height: null, position: null });
});

test('any other scale: zoom, sized to the window ÷ zoom, and position: relative (the Floating UI fix)', () => {
  for (const z of [0.9, 1.1, 1.25, 1.5]) {
    const st = S.bodyScaleStyle(z, 1600, 900);
    assert.equal(st.zoom, String(z));
    assert.equal(st.position, 'relative');
    assert.ok(Math.abs(parseFloat(st.width) * z - 1600) < 1e-6);
    assert.ok(Math.abs(parseFloat(st.height) * z - 900) < 1e-6);
  }
});

test('viewport vars cancel the zoom', () => {
  assert.deepEqual(S.viewportVars(1), { '--il-vw': '1vw', '--il-vh': '1vh', '--il-dvh': '1dvh' });
  const v = S.viewportVars(1.1);
  assert.ok(Math.abs(parseFloat(v['--il-vw']) * 1.1 - 1) < 1e-5);
  assert.match(v['--il-dvh'], /dvh$/);
  assert.equal(S.vw(94), 'calc(94 * var(--il-vw, 1vw))');
  assert.equal(S.dvh(100), 'calc(100 * var(--il-dvh, 1dvh))');
});

test('toCssPx divides the live zoom out', () => {
  S.setUiZoom(1.1);
  assert.ok(Math.abs(S.toCssPx(1100) - 1000) < 1e-9);
  S.setUiZoom(0);
  assert.equal(S.uiZoom(), 1);
  assert.equal(S.toCssPx(500, 1.25), 400);
});

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SRC = path.join(__dirname, '..', 'src');
const code = (txt) => txt.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*(\*|\/\/|\/\*)/.test(l));

test('no raw vw / vh / dvh in next/src (use vw() / vh() / dvh() from theme/uiScale)', () => {
  const bad = [];
  for (const f of walk(SRC)) {
    if (f.endsWith(path.join('theme', 'uiScale.ts'))) continue;
    for (const [n, l] of code(fs.readFileSync(f, 'utf8'))) {
      const stripped = l.replace(/var\(--il-d?v[wh],\s*1d?v[wh]\)/g, '').replace(/--il-d?v[wh]:\s*1d?v[wh]/g, '');
      if (/\b\d+(\.\d+)?(vw|vh|dvh|svh|lvh)\b/.test(stripped)) bad.push(`${path.relative(SRC, f)}:${n}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no floating element on the fixed strategy (it skips the zoom correction)', () => {
  const bad = [];
  for (const f of walk(SRC)) {
    for (const [n, l] of code(fs.readFileSync(f, 'utf8'))) {
      if (/floatingStrategy\s*[=:]\s*\{?\s*['"]fixed/.test(l) || /strategy:\s*['"]fixed/.test(l)) bad.push(`${path.relative(SRC, f)}:${n}`);
    }
  }
  assert.deepEqual(bad, []);
});
