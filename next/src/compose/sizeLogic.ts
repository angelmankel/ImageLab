/**
 * The Composition tab's size rules (fix list 2), pure and tested in tests/compose.test.cjs.
 * Shape first (Portrait / Square / Landscape, then a ratio), then the size: "Model default" =
 * the model type's native pixel count (SD 1.5 512², SDXL 1024², Qwen 1328²…) in that shape, on the
 * 64 grid (2:3 at SDXL → 832 × 1216, the SDXL buckets), or Custom (W / H, ± 64). With an input
 * picture the output keeps the picture's shape; the size is Model default (the native pixel
 * count in the picture's shape), Picture size, or Custom (± 64 on the long side).
 */

export type Orient = 'portrait' | 'square' | 'landscape';
export interface Ratio { id: string; w: number; h: number }

export const RATIOS: Record<Orient, readonly Ratio[]> = {
  portrait: [{ id: '2:3', w: 2, h: 3 }, { id: '3:4', w: 3, h: 4 }, { id: '4:5', w: 4, h: 5 }, { id: '9:16', w: 9, h: 16 }],
  square: [{ id: '1:1', w: 1, h: 1 }],
  landscape: [{ id: '3:2', w: 3, h: 2 }, { id: '4:3', w: 4, h: 3 }, { id: '5:4', w: 5, h: 4 }, { id: '16:9', w: 16, h: 9 }],
};
export const DEFAULT_RATIO: Record<Orient, string> = { portrait: '2:3', square: '1:1', landscape: '3:2' };
const ALL: readonly Ratio[] = [...RATIOS.portrait, ...RATIOS.square, ...RATIOS.landscape];

export const ratioById = (id: string): Ratio => ALL.find((r) => r.id === id) ?? ALL.find((r) => r.id === '1:1')!;
export const orientOfRatio = (r: Pick<Ratio, 'w' | 'h'>): Orient => (r.w === r.h ? 'square' : r.w > r.h ? 'landscape' : 'portrait');
export const orientOf = (w: number, h: number): Orient => (Math.abs(w / h - 1) < 0.02 ? 'square' : w > h ? 'landscape' : 'portrait');

/** The listed ratio nearest a size (by log error). */
export function nearestRatio(w: number, h: number): Ratio {
  if (!(w > 0) || !(h > 0)) return ratioById('1:1');
  const r = Math.log(w / h);
  let best = ALL[0];
  for (const x of ALL) if (Math.abs(Math.log(x.w / x.h) - r) < Math.abs(Math.log(best.w / best.h) - r)) best = x;
  return best;
}

/** The same ratio turned the other way (2:3 ↔ 3:2); 1:1 stays. */
export const flipRatio = (id: string): string => { const r = ratioById(id); return ALL.find((x) => x.w === r.h && x.h === r.w)?.id ?? id; };

export const GRID = 64;
export const MIN_SIDE = 256;
export const MAX_SIDE = 4096;
const FALLBACK_AREA = 1024 * 1024;

/** A model type's native pixel count from its default size; 1024² when unknown. */
export const nativeArea = (d: { width?: number; height?: number } | null | undefined): number =>
  d?.width && d?.height ? d.width * d.height : FALLBACK_AREA;

/**
 * The size on the 64 grid with about `area` pixels in the shape `rw : rh`: the pair closest in
 * shape (×3 weight) and in pixel count, never more than the model's native count.
 */
export function sizeForArea(area: number, rw: number, rh: number, step = GRID): { width: number; height: number } {
  const ratio = rw / rh;
  const idealW = Math.sqrt(area * ratio);
  const idealH = idealW / ratio;
  let best: { width: number; height: number; score: number } | null = null;
  const span = (ideal: number) => { const c = Math.round(ideal / step); return [c - 2, c - 1, c, c + 1, c + 2].map((k) => k * step).filter((v) => v >= step); };
  for (const w of span(idealW)) {
    for (const h of span(idealH)) {
      if (w * h > area) continue;
      const score = 3 * Math.abs(Math.log((w / h) / ratio)) + Math.abs(Math.log((w * h) / area));
      if (!best || score < best.score) best = { width: w, height: h, score };
    }
  }
  if (!best) { const s = Math.max(step, Math.floor(Math.sqrt(area) / step) * step); return { width: s, height: s }; }
  return { width: best.width, height: best.height };
}

/** Snap a typed side to 8, inside the limits. */
export const snapSide = (n: number): number => Math.min(MAX_SIDE, Math.max(64, Math.round((Number.isFinite(n) ? n : 1024) / 8) * 8));

/** ± one 64 step on a side, staying on the grid and inside the limits. */
export function stepSide(n: number, dir: 1 | -1): number {
  const next = dir > 0 ? Math.floor(n / GRID) * GRID + GRID : Math.ceil(n / GRID) * GRID - GRID;
  return Math.min(MAX_SIDE, Math.max(MIN_SIDE, next));
}

/** A custom size reshaped to a ratio at about the same pixel count (a ratio chip in Custom). */
export const reshape = (w: number, h: number, r: Pick<Ratio, 'w' | 'h'>): { width: number; height: number } => sizeForArea(w * h * 1.01, r.w, r.h);

/** Smaller / Larger from Model default: about one 64 step on the long side, same shape. */
export function scaleStep(w: number, h: number, dir: 1 | -1): { width: number; height: number } {
  const long = Math.max(w, h);
  const next = stepSide(long, dir);
  const k = next / long;
  const short = Math.max(GRID, Math.round((Math.min(w, h) * k) / GRID) * GRID);
  return w >= h ? { width: next, height: short } : { width: short, height: next };
}

/** img2img: the output of a picture scaled so its long side is in [min, max] (what the graph does). */
export function scaledInput(w: number, h: number, maxEdge: number, minEdge: number): { width: number; height: number } {
  const long = Math.max(w, h) || 1;
  const k = maxEdge > 0 && long > maxEdge ? maxEdge / long : minEdge > 0 && long < minEdge ? minEdge / long : 1;
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** img2img Model default: the long side that gives the picture about the native pixel count. */
export const nativeLongSide = (w: number, h: number, area: number): number => {
  const s = sizeForArea(area, w, h);
  return Math.max(s.width, s.height);
};

/** img2img Picture size: its own long side, capped. */
export const pictureLongSide = (w: number, h: number): number => Math.min(MAX_SIDE, Math.max(64, Math.max(w, h)));
