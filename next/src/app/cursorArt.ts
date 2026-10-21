/**
 * Fix list 2 #21: the app's own cursor drawings. Every cursor is drawn on a 24×24 grid as one set
 * of shapes, painted twice: a light outline layer (the shapes stroked wide in near-white) under a
 * dark core layer (the same shapes in near-black), so it reads on any picture. Details (the + in
 * zoom-in) are light on the core. Pure strings, no DOM (tests/cursorArt.test.cjs).
 */

export type CursorName =
  | 'pointer' | 'zoom-in' | 'zoom-out' | 'grab' | 'grabbing' | 'move' | 'crosshair' | 'not-allowed'
  | 'ew-resize' | 'ns-resize' | 'nwse-resize' | 'nesw-resize' | 'col-resize' | 'row-resize';

const LIGHT = '#FAFAFA';
const CORE = '#17171A';

interface Art {
  /** Filled shapes (paths / circles / rects), painted as outline then core. */
  fill?: string;
  /** Stroked lines: [d, core width]. Outline = core width + 3. */
  lines?: ReadonlyArray<[string, number]>;
  /** Light details drawn on top of the core. */
  detail?: string;
  /** Hotspot on the 24 grid. */
  hot: [number, number];
  /** Rotation (degrees) round the centre, for the resize family. */
  rotate?: number;
}

/** Faint light seams between fingers on the dark core. */
const seams = (ds: readonly string[]) => `<path d="${ds.join(' ')}" stroke="${LIGHT}" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" fill="none"/>`;

const OUT = 3; // outline thickness (stroke width added round shapes = 1.5 px each side)

/** A double-headed arrow along x through the centre (the resize family rotates it). */
const DOUBLE = 'M2.5 12 L7.5 7 V10.4 H16.5 V7 L21.5 12 L16.5 17 V13.6 H7.5 V17 Z';

const ART: Record<CursorName, Art> = {
  pointer: {
    // index finger up, three folded fingers, palm, thumb on the left
    fill: 'M8.6 3.2a1.7 1.7 0 0 1 3.4 0V9.6a1.6 1.6 0 0 1 3.1 .3a1.6 1.6 0 0 1 3.1 .5a1.6 1.6 0 0 1 3 .8V15.8a6.2 6.2 0 0 1-6.2 6.2H13.2a5.6 5.6 0 0 1-4.7-2.6L5 14.2a1.7 1.7 0 0 1 2.7-2l.9 1.1Z',
    detail: seams(['M12 10.2v3.6', 'M15.1 10.6v3.2', 'M18.2 11.2v2.8']),
    hot: [10.3, 2],
  },
  'zoom-in': {
    fill: '<circle cx="10" cy="10" r="7"/>',
    lines: [['M15.2 15.2 L20.6 20.6', 3.4]],
    detail: `<path d="M10 6.6v6.8M6.6 10h6.8" stroke="${LIGHT}" stroke-width="2" stroke-linecap="round"/>`,
    hot: [10, 10],
  },
  'zoom-out': {
    fill: '<circle cx="10" cy="10" r="7"/>',
    lines: [['M15.2 15.2 L20.6 20.6', 3.4]],
    detail: `<path d="M6.6 10h6.8" stroke="${LIGHT}" stroke-width="2" stroke-linecap="round"/>`,
    hot: [10, 10],
  },
  grab: {
    // four open fingers + thumb + palm
    lines: [['M7.6 12.5V7.2', 2.6], ['M10.6 11.5V4.6', 2.6], ['M13.6 11.5V4.4', 2.6], ['M16.6 12V6.2', 2.6], ['M4.6 13.2 L7.2 16.4', 2.6]],
    fill: 'M6.3 11.5H18V16.2A5.8 5.8 0 0 1 12.2 22H11.6A5.6 5.6 0 0 1 6.3 16.4Z',
    detail: seams(['M9.1 8.6v4.4', 'M12.1 7v5.6', 'M15.1 7.6v5']),
    hot: [12, 12],
  },
  grabbing: {
    // fingers folded into the palm
    lines: [['M7.6 11.6V9.8', 2.6], ['M10.6 11V8.6', 2.6], ['M13.6 11V8.6', 2.6], ['M16.6 11.6V9.8', 2.6]],
    fill: 'M6.3 10.6H18V15.6A5.8 5.8 0 0 1 12.2 21.4H11.6A5.6 5.6 0 0 1 6.3 15.8Z',
    detail: seams(['M9.1 9.2v3', 'M12.1 8.6v3.4', 'M15.1 9.2v3']),
    hot: [12, 12],
  },
  move: {
    lines: [['M12 5V19', 2], ['M5 12H19', 2]],
    fill: 'M12 1.8L15.4 5.6H8.6Z M12 22.2L8.6 18.4H15.4Z M1.8 12L5.6 8.6V15.4Z M22.2 12L18.4 15.4V8.6Z',
    hot: [12, 12],
  },
  crosshair: {
    lines: [['M12 2.5V7.6', 2], ['M12 16.4V21.5', 2], ['M2.5 12H7.6', 2], ['M16.4 12H21.5', 2]],
    detail: `<circle cx="12" cy="12" r="1.1" fill="${CORE}" stroke="${LIGHT}" stroke-width="1"/>`,
    hot: [12, 12],
  },
  'not-allowed': {
    lines: [['M12 4.2a7.8 7.8 0 1 1 0 15.6a7.8 7.8 0 1 1 0-15.6Z', 2.6], ['M6.6 6.6L17.4 17.4', 2.6]],
    hot: [12, 12],
  },
  'ew-resize': { fill: DOUBLE, hot: [12, 12] },
  'ns-resize': { fill: DOUBLE, hot: [12, 12], rotate: 90 },
  'nwse-resize': { fill: DOUBLE, hot: [12, 12], rotate: 45 },
  'nesw-resize': { fill: DOUBLE, hot: [12, 12], rotate: -45 },
  'col-resize': { fill: 'M2.5 12 L6.8 7.6 V16.4 Z M21.5 12 L17.2 16.4 V7.6 Z', lines: [['M10.2 5V19', 2], ['M13.8 5V19', 2]], hot: [12, 12] },
  'row-resize': { fill: 'M2.5 12 L6.8 7.6 V16.4 Z M21.5 12 L17.2 16.4 V7.6 Z', lines: [['M10.2 5V19', 2], ['M13.8 5V19', 2]], hot: [12, 12], rotate: 90 },
};

export const CURSOR_NAMES = Object.keys(ART) as CursorName[];

/** A `fill` entry is either raw path data or ready SVG elements. */
const shapes = (fill: string, attrs: string) => (fill.trim().startsWith('<') ? `<g ${attrs}>${fill}</g>` : `<path d="${fill}" ${attrs}/>`);

/** The SVG of one cursor at `px` CSS pixels square (24 = 1×; pass 48 for the 2× image). */
export function cursorSvg(name: CursorName, px = 24): string {
  const a = ART[name];
  const lines = a.lines ?? [];
  const outline = [
    ...lines.map(([d, w]) => `<path d="${d}" fill="none" stroke="${LIGHT}" stroke-width="${w + OUT}" stroke-linecap="round" stroke-linejoin="round"/>`),
    a.fill ? shapes(a.fill, `fill="${LIGHT}" stroke="${LIGHT}" stroke-width="${OUT}" stroke-linejoin="round"`) : '',
  ].join('');
  const core = [
    ...lines.map(([d, w]) => `<path d="${d}" fill="none" stroke="${CORE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`),
    a.fill ? shapes(a.fill, `fill="${CORE}"`) : '',
  ].join('');
  const body = `${outline}${core}${a.detail ?? ''}`;
  const g = a.rotate ? `<g transform="rotate(${a.rotate} 12 12)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${g}</svg>`;
}

const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/**
 * The CSS `cursor` value: crisp 1× / 2× images at `scale` (the UI size, item 4: 1.1 = 110%), the
 * hotspot scaled with it, then the native keyword as the fallback.
 */
export function cursorCss(name: CursorName, scale = 1, imageSet = true): string {
  const s = Math.max(0.5, Math.min(2, scale));
  const px = Math.round(24 * s);
  const [hx, hy] = ART[name].hot.map((v) => Math.round(v * s));
  const one = url(cursorSvg(name, px));
  const img = imageSet ? `-webkit-image-set(${one} 1x, ${url(cursorSvg(name, px * 2))} 2x)` : one;
  return `${img} ${hx} ${hy}, ${name}`;
}
