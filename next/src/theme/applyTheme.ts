/**
 * Item 35: writes one theme onto the page. CSS vars + data-attributes on <html> (themeVars), the
 * live layout factors (`T.radius` / `T.gap`), the browser's theme-color, and the whole-UI scale.
 *
 * Scale = CSS `zoom` on <body> (every px in the app is inline, so rem scaling would do nothing).
 * The body is then sized to the viewport ÷ zoom in px, so the zoomed page still fits the window
 * exactly; Mantine portals live in <body> and scale with it. At 100% nothing is set at all. A
 * browser without `zoom` keeps 100% (`scaleSupported`). What floating / full-window code must do
 * under the zoom (FIXLIST-2 item 4): see `uiScale.ts` (body `position: relative`, vw() / vh(),
 * toCssPx()).
 */
import { LIVE } from './live';
import { bodyScaleStyle, setUiZoom, viewportVars } from './uiScale';
import { DENSITY_FACTOR, themeVars, type Palette, type ThemeSettings } from './themeModel';

export const scaleSupported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1.1');

let scale = 1;
let listening = false;

function sizeBody() {
  const body = document.body;
  if (!body) return;
  const html = document.documentElement;
  for (const [k, v] of Object.entries(bodyScaleStyle(scale, html.clientWidth, html.clientHeight))) {
    if (v == null) body.style.removeProperty(k);
    else body.style.setProperty(k, v);
  }
}

function applyScale(s: number) {
  scale = scaleSupported ? s : 1;
  setUiZoom(scale);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(viewportVars(scale))) root.style.setProperty(k, v);
  if (scale !== 1 && !listening) {
    listening = true;
    window.addEventListener('resize', sizeBody);
    window.visualViewport?.addEventListener('resize', sizeBody);
  }
  if (document.body) sizeBody();
  else document.addEventListener('DOMContentLoaded', sizeBody, { once: true });
}

export function applyTheme(theme: ThemeSettings, preview: Palette | null) {
  const t = preview ? { ...theme, palette: preview } : theme;
  const { vars, data } = themeVars(t);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  for (const [k, v] of Object.entries(data)) {
    if (v == null) delete root.dataset[k];
    else root.dataset[k] = v;
  }
  LIVE.corners = t.corners;
  LIVE.density = DENSITY_FACTOR[t.density];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--il-bg']);
  applyScale(t.scale);
}
