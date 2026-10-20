/**
 * Size logic for the Settings tab (rule 5): an aspect ratio × a longest side → width × height.
 * Pure, imports nothing, so `tests/size.test.cjs` loads it straight from source.
 *
 * Rounding: the longest side is taken as given; the short side is `longest × short/long`
 * rounded to the nearest multiple of `step` (64 by default, the SDXL bucket grid — 2:3 at 1216
 * gives 832 × 1216, 16:9 at 1344 gives 1344 × 768, as the old presets did). Manual sizes snap to
 * 8 (number boxes) or 64 (sliders), as the old DimensionsField did.
 */

export type AspectId = '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '16:9' | '3:2' | '4:3' | 'custom';

export interface Aspect { id: AspectId; w: number; h: number; label: string }

/** The buttons, in the order they show. `custom` is the last one and has no ratio of its own. */
export const ASPECTS: readonly Aspect[] = [
  { id: '1:1', w: 1, h: 1, label: 'Square' },
  { id: '4:5', w: 4, h: 5, label: 'Portrait' },
  { id: '3:4', w: 3, h: 4, label: 'Portrait' },
  { id: '2:3', w: 2, h: 3, label: 'Portrait' },
  { id: '9:16', w: 9, h: 16, label: 'Tall' },
  { id: '16:9', w: 16, h: 9, label: 'Wide' },
  { id: '3:2', w: 3, h: 2, label: 'Landscape' },
  { id: '4:3', w: 4, h: 3, label: 'Landscape' },
];

/** The longest-side chips. */
export const LONGEST_SIDES: readonly number[] = [768, 1024, 1280, 1536, 2048];

/** Slider range (step 64) and number-box range (step 8), as the old DimensionsField had them. */
export const SLIDER_MIN = 256;
export const SLIDER_MAX = 2048;
export const SLIDER_STEP = 64;
export const BOX_MIN = 64;
export const BOX_MAX = 4096;
export const BOX_STEP = 8;

/** Nearest multiple of `step`, never below `step`. */
export function roundTo(n: number, step: number): number {
  if (!Number.isFinite(n)) return step;
  return Math.max(step, Math.round(n / step) * step);
}

/** Clamp then snap to `step`. */
export function snap(n: number, min: number, max: number, step: number): number {
  const v = Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  return Math.min(max, Math.max(min, Math.round(v / step) * step));
}

/** Width × height for an aspect at a longest side. A square gives longest × longest. */
export function sizeFor(aspect: Pick<Aspect, 'w' | 'h'>, longest: number, step = SLIDER_STEP): { width: number; height: number } {
  const long = roundTo(longest, step);
  if (aspect.w === aspect.h) return { width: long, height: long };
  if (aspect.w > aspect.h) return { width: long, height: roundTo(long * aspect.h / aspect.w, step) };
  return { width: roundTo(long * aspect.w / aspect.h, step), height: long };
}

/** Scale a custom size so its longest side is `longest`, keeping its own ratio. */
export function scaleToLongest(width: number, height: number, longest: number, step = SLIDER_STEP): { width: number; height: number } {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  return sizeFor({ w, h }, longest, step);
}

export function longestOf(width: number, height: number): number {
  return Math.max(width, height);
}

/**
 * Which aspect button a size belongs to: the button whose preset at this longest side is exactly
 * this size, else (the buckets only approximate their ratios: 832 × 1216 is 1.46, not 1.5) the
 * nearest named one within 4 %, else `custom`.
 */
export function aspectOf(width: number, height: number, tolerance = 0.04): AspectId {
  if (!(width > 0) || !(height > 0)) return 'custom';
  // A size a button + chip would make is that button, whatever the rounding did to its ratio.
  const long = longestOf(width, height);
  for (const a of ASPECTS) {
    const s = sizeFor(a, long);
    if (s.width === width && s.height === height) return a.id;
  }
  const r = width / height;
  let best: { id: AspectId; err: number } | null = null;
  for (const a of ASPECTS) {
    const err = Math.abs(r / (a.w / a.h) - 1);
    if (err < tolerance && (!best || err < best.err)) best = { id: a.id, err };
  }
  return best ? best.id : 'custom';
}

/** The aspect for an id; `custom` and unknown ids give undefined. */
export function aspectById(id: string): Aspect | undefined {
  return ASPECTS.find((a) => a.id === id);
}

/** True when a size is exactly what its aspect button and longest-side chip would make. */
export function isPresetSize(width: number, height: number, step = SLIDER_STEP): boolean {
  const id = aspectOf(width, height);
  if (id === 'custom') return false;
  const s = sizeFor(aspectById(id)!, longestOf(width, height), step);
  return s.width === width && s.height === height;
}

/** Which longest-side chip is lit: the exact value, or none when the size is between chips. */
export function longestChip(width: number, height: number): number | null {
  const l = longestOf(width, height);
  return LONGEST_SIDES.includes(l) ? l : null;
}

/** `1024 × 768`. */
export function fmtSize(width: number, height: number): string {
  return `${width} × ${height}`;
}

/** Megapixels with two decimals, for the hint under the manual sliders. */
export function megapixels(width: number, height: number): string {
  return ((width * height) / 1_000_000).toFixed(2);
}
