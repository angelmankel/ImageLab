const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('./_load.cjs')('src/app/cursorArt.ts');

test('every cursor: an svg at 1x / 2x, hotspot inside, the native keyword as fallback', () => {
  for (const n of C.CURSOR_NAMES) {
    assert.match(C.cursorSvg(n), /^<svg [^>]*width="24" height="24"/);
    assert.match(C.cursorSvg(n, 48), /width="48" height="48"/);
    const css = C.cursorCss(n);
    assert.ok(css.startsWith('-webkit-image-set(url("data:image/svg+xml,'), n);
    assert.ok(css.endsWith(`, ${n}`), n);
    const [, x, y] = css.match(/\) (\d+) (\d+), [a-z-]+$/);
    assert.ok(+x >= 0 && +x < 24 && +y >= 0 && +y < 24, n);
  }
});

test('plain url form when image-set is not supported; scale grows the image and hotspot', () => {
  assert.ok(C.cursorCss('move', 1, false).startsWith('url("data:'));
  assert.match(decodeURIComponent(C.cursorCss('crosshair', 1.5, false)), /width="36"/);
  assert.match(C.cursorCss('crosshair', 1.5, false), /\) 18 18, crosshair$/);
});
