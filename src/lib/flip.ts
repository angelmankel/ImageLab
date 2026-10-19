// The shared-element transition between a thumbnail (or the hero) and the fullscreen viewer, as
// rectangles: where the picture is painted in its box, and the transform that lays the fullscreen
// copy over that spot so it can grow from there and shrink back. Imports nothing.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/**
 * Where an image of `natural` size is painted inside `box` under `object-fit: contain` (letterboxed,
 * centred) or `cover` (fills, centred, overflowing). A missing or empty natural size paints the box.
 */
export function fitRect(natural: Size | null, box: Rect, fit: 'contain' | 'cover' = 'contain'): Rect {
  if (!natural || natural.w <= 0 || natural.h <= 0 || box.w <= 0 || box.h <= 0) return { ...box };
  const sx = box.w / natural.w;
  const sy = box.h / natural.h;
  const s = fit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
  const w = natural.w * s;
  const h = natural.h * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export interface Flip { x: number; y: number; sx: number; sy: number }

/**
 * The transform (origin top-left, applied to the element whose painted rect is `to`) that puts it
 * exactly over `from`: translate then scale. Degenerate rects give the identity.
 */
export function flipFrom(from: Rect, to: Rect): Flip {
  if (to.w <= 0 || to.h <= 0 || from.w <= 0 || from.h <= 0) return { x: 0, y: 0, sx: 1, sy: 1 };
  const sx = from.w / to.w;
  const sy = from.h / to.h;
  return { x: from.x - to.x * sx, y: from.y - to.y * sy, sx, sy };
}

export const flipTransform = (f: Flip) =>
  `translate(${round(f.x)}px, ${round(f.y)}px) scale(${round(f.sx, 4)}, ${round(f.sy, 4)})`;

/** True when the rect is on screen with some size — an origin worth growing from. */
export function visibleRect(r: Rect, viewport: Size): boolean {
  return r.w > 4 && r.h > 4 && r.x < viewport.w && r.y < viewport.h && r.x + r.w > 0 && r.y + r.h > 0;
}

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
