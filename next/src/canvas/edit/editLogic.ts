/**
 * Item 13, the pure part of Edit mode (tests/editLogic.test.cjs): the "look" (colour sliders and
 * toggles that preview live on the GPU), the edit history (undo / redo / reset), and the crop
 * rectangle maths (drag a handle or the inside, keep a ratio, stay inside the picture).
 */

/** The live colour adjustments. Sliders are −100…100 (hue −180…180°, blur 0…40 px). */
export interface Look {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  invert: boolean;
  gray: boolean;
}

export const NEUTRAL_LOOK: Look = Object.freeze({ brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, invert: false, gray: false });

export const isNeutralLook = (l: Look): boolean =>
  !l.brightness && !l.contrast && !l.saturation && !l.hue && !l.blur && !l.invert && !l.gray;

/** One colour-matrix call, in order (Pixi's ColorMatrixFilter methods, multiplied). */
export type MatrixStep = ['brightness' | 'contrast' | 'saturate' | 'hue' | 'greyscale', number] | ['negative'];

/** The ColorMatrixFilter calls for a look (empty = no colour filter). */
export function lookMatrix(l: Look): MatrixStep[] {
  const out: MatrixStep[] = [];
  if (l.brightness) out.push(['brightness', 1 + l.brightness / 100]);
  if (l.contrast) out.push(['contrast', l.contrast / 100]);
  if (l.saturation) out.push(['saturate', l.saturation / 100]);
  if (l.hue) out.push(['hue', l.hue]);
  if (l.gray) out.push(['greyscale', 1]);
  if (l.invert) out.push(['negative']);
  return out;
}

// ---- History ---------------------------------------------------------------

export interface History<T> { past: T[]; present: T; future: T[] }

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** A new state after the present (drops the redo tail). `merge` replaces the present instead (a slider drag). */
export function commit<T>(h: History<T>, next: T, merge = false, cap = 40): History<T> {
  if (merge) return { past: h.past, present: next, future: [] };
  const past = [...h.past, h.present];
  return { past: past.length > cap ? past.slice(past.length - cap) : past, present: next, future: [] };
}

export function undoH<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redoH<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** Back to the very first state, as one undoable step. */
export function resetH<T>(h: History<T>): History<T> {
  const first = h.past[0];
  if (first === undefined) return h;
  return commit(h, first);
}

// ---- Crop -----------------------------------------------------------------

export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export const MIN_CROP = 16;

/** The largest rect of `ratio` (w / h) centred in W × H; null ratio = the whole picture. */
export function ratioRect(W: number, H: number, ratio: number | null): Rect {
  if (!ratio || ratio <= 0) return { x: 0, y: 0, w: W, h: H };
  let w = W; let h = w / ratio;
  if (h > H) { h = H; w = h * ratio; }
  w = Math.round(w); h = Math.round(h);
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

/**
 * Drag `handle` of `start` by (dx, dy) image px, inside W × H. A ratio keeps its shape (corners
 * follow the larger move; edges grow the other side about the centre). Never smaller than MIN_CROP.
 */
export function dragCrop(start: Rect, handle: Handle, dx: number, dy: number, W: number, H: number, ratio: number | null = null): Rect {
  if (handle === 'move') {
    const x = Math.min(Math.max(0, start.x + dx), W - start.w);
    const y = Math.min(Math.max(0, start.y + dy), H - start.h);
    return { x: Math.round(x), y: Math.round(y), w: start.w, h: start.h };
  }
  let l = start.x, t = start.y, r = start.x + start.w, b = start.y + start.h;
  if (handle.includes('w')) l = Math.min(Math.max(0, l + dx), r - MIN_CROP);
  if (handle.includes('e')) r = Math.max(Math.min(W, r + dx), l + MIN_CROP);
  if (handle.includes('n')) t = Math.min(Math.max(0, t + dy), b - MIN_CROP);
  if (handle.includes('s')) b = Math.max(Math.min(H, b + dy), t + MIN_CROP);
  if (ratio && ratio > 0) {
    let w = r - l, h = b - t;
    const corner = handle.length === 2;
    if (corner) {
      // The larger relative move decides; the opposite corner stays put.
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
      // Keep inside the picture from the fixed corner.
      const maxW = handle.includes('w') ? r : W - l;
      const maxH = handle.includes('n') ? b : H - t;
      if (w > maxW) { w = maxW; h = w / ratio; }
      if (h > maxH) { h = maxH; w = h * ratio; }
      if (handle.includes('w')) l = r - w; else r = l + w;
      if (handle.includes('n')) t = b - h; else b = t + h;
    } else if (handle === 'e' || handle === 'w') {
      h = w / ratio;
      const cy = (start.y + start.y + start.h) / 2;
      if (h > H) { h = H; w = h * ratio; if (handle === 'w') l = r - w; else r = l + w; }
      t = Math.min(Math.max(0, cy - h / 2), H - h); b = t + h;
    } else {
      w = h * ratio;
      const cx = (start.x + start.x + start.w) / 2;
      if (w > W) { w = W; h = w / ratio; if (handle === 'n') t = b - h; else b = t + h; }
      l = Math.min(Math.max(0, cx - w / 2), W - w); r = l + w;
    }
  }
  return { x: Math.round(l), y: Math.round(t), w: Math.round(r - l), h: Math.round(b - t) };
}

export const isWholeRect = (r: Rect, W: number, H: number) => r.x <= 0 && r.y <= 0 && r.w >= W && r.h >= H;

/** The crop ratio choices (null = free, 'orig' = the picture's own). */
export const CROP_RATIOS: readonly { id: string; label: string; ratio: number | null | 'orig' }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'orig', label: 'Original', ratio: 'orig' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];
