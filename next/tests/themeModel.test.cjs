// Settings → Themes, the pure part (src/theme/themeModel.ts): colour maths round-trips, the
// generator reproduces Ember at tint 0, OLED blacks out any palette's backgrounds, the sanitizer
// clamps / drops junk, the import accepts our file, a bare theme or a bare palette.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const M = load('src/theme/themeModel.ts');

test('hex ⇄ OKLCH round-trips', () => {
  for (const hex of ['#F0863A', '#141416', '#3DD68C', '#FFFFFF', '#000000', '#4FA3F7']) {
    assert.equal(M.oklchToHex(M.hexToOklch(hex)), hex);
  }
  assert.equal(M.rgbToHex(M.hexToRgb('#abc')), '#AABBCC');
  assert.equal(M.isHex('#12345'), false);
  assert.equal(M.isHex('#a1b2c3'), true);
});

test('out-of-gamut OKLCH is clamped by chroma, not broken', () => {
  const hex = M.oklchToHex({ l: 0.7, c: 0.5, h: 140 });
  assert.match(hex, /^#[0-9A-F]{6}$/);
});

test('generator at tint 0 reproduces Ember greys and accent exactly', () => {
  const g = M.generatePalette({ ...M.DEFAULT_GEN, tint: 0 });
  for (const k of ['bgDeep', 'bg', 'panel', 'elev', 'card', 'cardOn', 'line', 'lineSoft', 'lineStrong', 'fg', 'fg2', 'muted', 'dim', 'ember', 'emberSoft']) {
    assert.equal(g[k], M.EMBER[k], k);
  }
});

test('generator: every token is a hex; depth and contrast move the ladder the right way', () => {
  const base = { ...M.DEFAULT_GEN, seed: '#4FA3F7', tint: 0.4 };
  const dark = M.generatePalette(base);
  for (const k of M.PALETTE_KEYS) assert.match(dark[k], /^#[0-9A-F]{6}$/, k);
  const deep = M.generatePalette({ ...base, depth: 'deep' });
  const dim = M.generatePalette({ ...base, depth: 'dim' });
  assert.ok(M.luminance(deep.bg) < M.luminance(dark.bg));
  assert.ok(M.luminance(dim.bg) > M.luminance(dark.bg));
  const high = M.generatePalette({ ...base, contrast: 'high' });
  assert.ok(M.contrast(high.muted, high.bg) > M.contrast(dark.muted, dark.bg));
});

test('a dark seed is lifted so dark text on the accent stays readable', () => {
  const p = M.generatePalette({ ...M.DEFAULT_GEN, seed: '#102060' });
  assert.ok(M.hexToOklch(p.ember).l >= 0.679);
  assert.ok(M.contrast(p.ember, M.onAccent(p)) >= 4);
});

test('second colour follows the harmony; custom uses the picked colour', () => {
  const near = M.hexToOklch(M.secondColour({ ...M.DEFAULT_GEN, harmony: 'near' })).h;
  const opp = M.hexToOklch(M.secondColour({ ...M.DEFAULT_GEN, harmony: 'opposite' })).h;
  const seedH = M.hexToOklch(M.DEFAULT_GEN.seed).h;
  const dist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  assert.ok(dist(near, seedH) < 60);
  assert.ok(dist(opp, seedH) > 120);
  const custom = M.secondColour({ ...M.DEFAULT_GEN, harmony: 'custom', second: '#E07AF0' });
  assert.ok(dist(M.hexToOklch(custom).h, M.hexToOklch('#E07AF0').h) < 8);
});

test('OLED: backgrounds go pure black for any palette; text and accent stay', () => {
  for (const pr of M.PRESETS) {
    const o = M.oledify(pr.palette);
    assert.equal(o.bg, '#000000');
    assert.equal(o.bgDeep, '#000000');
    assert.equal(o.panel, '#000000');
    assert.ok(M.luminance(o.card) < M.luminance(pr.palette.card));
    assert.ok(M.luminance(o.card) > 0);
    assert.equal(o.fg, pr.palette.fg);
    assert.equal(o.ember, pr.palette.ember);
  }
});

test('presets: unique ids, Ember first and exact', () => {
  const ids = M.PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(M.PRESETS[0].id, 'ember');
  assert.deepEqual(M.PRESETS[0].palette, M.EMBER);
});

test('sanitizeTheme: defaults for junk, clamps numbers, drops bad colours', () => {
  assert.deepEqual(M.sanitizeTheme(null), M.DEFAULT_THEME);
  const t = M.sanitizeTheme({ scale: 9, corners: -1, btnRound: 0.5, font: 'comic', motion: 'off', palette: { bg: '#000', fg: 'red', ember: 12 }, extra: 1 });
  assert.equal(t.scale, M.SCALE_MAX);
  assert.equal(t.corners, M.CORNERS_MIN);
  assert.equal(t.btnRound, 0.5);
  assert.equal(t.font, 'manrope');
  assert.equal(t.motion, 'off');
  assert.equal(t.palette.bg, '#000000');
  assert.equal(t.palette.fg, M.EMBER.fg);
  assert.equal(t.palette.ember, M.EMBER.ember);
  assert.equal('extra' in t, false);
});

test('themeVars: every palette token becomes its --il- var; OLED and motion flags', () => {
  const { vars, data } = M.themeVars(M.DEFAULT_THEME);
  assert.equal(vars['--il-bg'], '#141416');
  assert.equal(vars['--il-bg-deep'], '#0F0F11');
  assert.equal(vars['--il-ember-hi'], '#FFB36B');
  assert.equal(vars['--il-btn-round'], '0.85');
  assert.equal(data.motion, null);
  const o = M.themeVars({ ...M.DEFAULT_THEME, oled: true, motion: 'off', accentGradient: true });
  assert.equal(o.vars['--il-bg'], '#000000');
  assert.equal(o.data.motion, 'off');
  assert.equal(o.data.oled, 'on');
  assert.match(o.vars['--il-accent-fill'], /--il-accent2/);
});

test('export → import round-trips; bare theme and bare palette import; junk is refused', () => {
  const theme = { ...M.DEFAULT_THEME, paletteId: 'ocean', palette: M.PRESETS[1].palette, scale: 1.1, oled: true };
  const back = M.parseThemeFile(JSON.stringify(M.exportTheme(theme, ' Night ')));
  assert.equal(back.ok, true);
  assert.equal(back.name, 'Night');
  assert.deepEqual(back.theme, theme);
  assert.equal(M.parseThemeFile(JSON.stringify(theme)).ok, true);
  const pal = M.parseThemeFile(JSON.stringify({ bg: '#000000', ember: '#FF0000' }));
  assert.equal(pal.ok, true);
  assert.equal(pal.theme.palette.ember, '#FF0000');
  assert.equal(M.parseThemeFile('nope').ok, false);
  assert.equal(M.parseThemeFile('[1,2]').ok, false);
  assert.equal(M.parseThemeFile('{"a":1}').ok, false);
});

test('shuffle gives a valid generator input', () => {
  let i = 0;
  const seq = [0.1, 0.5, 0.9, 0.3, 0.7];
  const g = M.shuffleGen(M.DEFAULT_GEN, () => seq[i++ % seq.length]);
  assert.ok(M.isHex(g.seed));
  assert.ok(g.tint >= 0 && g.tint <= 1);
  assert.ok(['near', 'opposite', 'triad'].includes(g.harmony));
});
