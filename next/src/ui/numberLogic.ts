/**
 * The number rules behind the shared Slider (item 1) and NumberField (item 38): snap to the step,
 * clamp, read what was typed, the user's own range from the slider cog. Pure, imports nothing
 * (tests/numbers.test.cjs).
 */

/** How many decimals a step needs: 1 → 0, 0.5 → 1, 0.05 → 2, 1e-3 → 3. */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(step);
  const e = s.match(/e-(\d+)$/i);
  if (e) return Number(e[1]);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** Round off float noise to the decimals the step uses (0.1 + 0.2 → 0.3). */
export function tidy(v: number, step: number): number {
  const d = Math.min(10, decimalsOf(step));
  return Number(v.toFixed(d));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Snap to the step grid that starts at `min`, then clamp and tidy. */
export function snap(v: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(v)) return clamp(min, min, max);
  const s = step > 0 ? step : 1;
  const n = Math.round((v - min) / s);
  return tidy(clamp(min + n * s, min, max), s);
}

/** One step up (`dir` 1) or down (-1), `mult` steps at once (Shift = 10). */
export function nudge(v: number, dir: 1 | -1, min: number, max: number, step: number, mult = 1): number {
  const s = step > 0 ? step : 1;
  // From an off-grid value go to the next grid line first, never skip one.
  const onGrid = Math.abs((v - min) / s - Math.round((v - min) / s)) < 1e-6;
  if (!onGrid) {
    const base = dir > 0 ? Math.ceil((v - min) / s) : Math.floor((v - min) / s);
    return snap(min + (base + dir * (mult - 1)) * s, min, max, s);
  }
  return snap(v + dir * s * mult, min, max, s);
}

/**
 * What the person typed → a number, or null when it is not one. Accepts a comma decimal
 * ("1,5"), spaces, a leading "+", a trailing unit ("30 steps", "1.5x", "×2"), and "." / "-" alone → null.
 */
export function parseTyped(text: string): number | null {
  const t = text.trim().replace(/^[×x*]\s*/i, '').replace(',', '.').replace(/\s+/g, '');
  const m = t.match(/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** The slider cog's own range for one slider (all optional; unset = the caller's). */
export interface RangeOverride { min?: number; max?: number; step?: number }

/**
 * The range a slider uses: the caller's with the person's override on top. An override that does
 * not make sense (min ≥ max, step ≤ 0, step wider than the range) falls back field by field.
 */
export function effectiveRange(base: { min: number; max: number; step: number }, o?: RangeOverride | null): { min: number; max: number; step: number } {
  if (!o) return base;
  let min = o.min != null && Number.isFinite(o.min) ? o.min : base.min;
  let max = o.max != null && Number.isFinite(o.max) ? o.max : base.max;
  if (!(min < max)) { min = base.min; max = base.max; }
  let step = o.step != null && Number.isFinite(o.step) && o.step > 0 ? o.step : base.step;
  if (step > max - min) step = base.step;
  return { min, max, step };
}

/** True when the override changes anything (shows the cog lit). */
export function isOverridden(base: { min: number; max: number; step: number }, o?: RangeOverride | null): boolean {
  const e = effectiveRange(base, o);
  return e.min !== base.min || e.max !== base.max || e.step !== base.step;
}

/** The phone keyboard for a step: whole numbers → numeric pad, else decimal (with a dot). */
export function inputModeFor(step: number, min: number): 'numeric' | 'decimal' {
  return decimalsOf(step) === 0 && min >= 0 ? 'numeric' : 'decimal';
}
