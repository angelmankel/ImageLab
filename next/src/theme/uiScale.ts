/**
 * The whole-UI scale (Themes → Scale) and what every floating / full-window thing needs to stay
 * right under it (FIXLIST-2 item 4 + 26). Pure: no imports, node-testable.
 *
 * The scale is CSS `zoom` on <body>. Zoom multiplies EVERY CSS length inside the body, including
 * `left` / `top` and viewport units, while getBoundingClientRect / clientX / innerWidth report real
 * window pixels. The three ways that went wrong, and the one fix for each:
 *  1. Mantine tooltips / popovers / menus / selects (Floating UI) measured real px and wrote them
 *     as CSS px, so at 110% every dropdown landed 10% further from the window's top-left corner.
 *     Fix: <body> gets `position: relative` while zoomed. Floating UI then uses the body as the
 *     offset parent, sees its scale (rect ÷ CSS size = zoom) and divides it out, like it does for a
 *     `transform: scale` parent. Keep every Floating UI element on the default `absolute` strategy
 *     (`fixed` resolves to the window and skips that correction; a test guards it).
 *  2. `100vw` / `92vh` inside the zoomed body = 110% of the window (modals ran off screen).
 *     Fix: use `vw()` / `vh()` / `dvh()` below (they read --il-vw / --il-vh / --il-dvh = 1 unit ÷ zoom).
 *  3. Hand-placed `position: fixed` things (our context menu) placed at clientX / a rect.
 *     Fix: convert window px with `toCssPx()` before writing them as left / top / width.
 */

let zoom = 1;

/** The live UI zoom (1 = 100%). */
export function uiZoom(): number { return zoom; }
/** Set by applyTheme only. */
export function setUiZoom(z: number) { zoom = z > 0 && Number.isFinite(z) ? z : 1; }

/** Window px (getBoundingClientRect, clientX, innerWidth) → CSS px inside the zoomed body. */
export function toCssPx(windowPx: number, z = zoom): number { return windowPx / z; }

/** The inline styles <body> wears for a scale; null props are removed. At 100%: nothing at all. */
export function bodyScaleStyle(scale: number, clientW: number, clientH: number): Record<'zoom' | 'width' | 'height' | 'position', string | null> {
  if (scale === 1) return { zoom: null, width: null, height: null, position: null };
  return { zoom: String(scale), width: `${clientW / scale}px`, height: `${clientH / scale}px`, position: 'relative' };
}

/** The root vars behind vw() / vh() / dvh(): one viewport unit ÷ zoom (zoom multiplies it back). */
export function viewportVars(scale: number): Record<'--il-vw' | '--il-vh' | '--il-dvh', string> {
  const k = scale === 1 ? '' : `${+(1 / scale).toFixed(6)}`;
  return { '--il-vw': `${k || 1}vw`, '--il-vh': `${k || 1}vh`, '--il-dvh': `${k || 1}dvh` };
}

/** `n` viewport units that stay n% of the real window at any UI scale. Use instead of 'NNvw' etc. */
export const vw = (n: number) => `calc(${n} * var(--il-vw, 1vw))`;
export const vh = (n: number) => `calc(${n} * var(--il-vh, 1vh))`;
export const dvh = (n: number) => `calc(${n} * var(--il-dvh, 1dvh))`;
