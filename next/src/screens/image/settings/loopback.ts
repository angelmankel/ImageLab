/**
 * Loopback logic for the Settings tab (the Image step = base image + Loopback, no Passes). The
 * pure side of `LoopbackCard`: chip lists, clamps, the patches each control writes, the header
 * summary ("×4 · grow 1.5 · denoise 0.5→0.3") and the size label ("1024 → 2048 px").
 *
 * Imports only types, so `tests/loopback.test.cjs` loads it from source. Every patch spreads the
 * saved settings first, so fields this card does not edit (`frame`, other `ramps`) survive and the
 * classic UI keeps working on the same workflow. The denoise defaults mirror
 * `DEFAULT_LOOPBACK` in `@/lib/pipeline` (0.6 → 0.3); the pipeline reads `iterations` clamped to
 * 1–10 and `steps` / `cfg` as real values (there is no "0 = the base's" rule), so the card shows
 * real values with presets.
 */
import type { LoopbackRampKey, LoopbackSettings } from '@/lib/types';

export type Ramp = { start: number; end: number };

/** The rounds chips; other counts go in the number box. */
export const ROUND_CHIPS: readonly number[] = [2, 3, 4, 5];
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;

/** Grow per round: chips + slider range (what the graph does per round, before the 4096px cap). */
export const GROW_CHIPS: readonly number[] = [1, 1.25, 1.5, 2];
export const GROW_MIN = 1;
export const GROW_MAX = 2;
export const GROW_STEP = 0.05;

export const DENOISE_CHIPS: readonly number[] = [0.3, 0.4, 0.5, 0.6];
export const DENOISE_MIN = 0.1;
export const DENOISE_MAX = 1;
export const DENOISE_STEP = 0.05;
/** Mirrors DEFAULT_LOOPBACK.denoiseStart / denoiseEnd. */
export const DENOISE_START_DEFAULT = 0.6;
export const DENOISE_END_DEFAULT = 0.3;

export const STEP_CHIPS: readonly number[] = [10, 15, 20, 30];
export const STEPS_MIN = 1;
export const STEPS_MAX = 60;

export const CFG_CHIPS: readonly number[] = [3, 5, 7, 9];
export const CFG_MIN = 1;
export const CFG_MAX = 20;
export const CFG_STEP = 0.5;

export const NOISE_CHIPS: readonly number[] = [0, 0.1, 0.2, 0.3];
export const NOISE_MIN = 0;
export const NOISE_MAX = 0.5;
export const NOISE_STEP = 0.05;

/** The values that can move from the first round to the last (denoise has its own fields). */
export const RAMP_KEYS: readonly LoopbackRampKey[] = ['upscale', 'steps', 'cfg', 'noise'];
export const RAMP_LABELS: Record<LoopbackRampKey, string> = { upscale: 'Grow', steps: 'Steps', cfg: 'CFG', noise: 'Noise' };

/** Clamp to [min, max] and snap to `step`; a non-number gives `min`. */
export function clampTo(n: number, min: number, max: number, step = 1): number {
  const v = Number.isFinite(n) ? n : min;
  const snapped = Math.round(v / step) * step;
  const digits = String(step).split('.')[1]?.length ?? 0;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(digits))));
}

/** Rounds as the pipeline will read them: a whole number from 1 to 10. */
export function clampRounds(n: number): number {
  return clampTo(Math.trunc(Number.isFinite(n) ? n : MIN_ROUNDS), MIN_ROUNDS, MAX_ROUNDS, 1);
}

/** Short numbers for chips and the summary: 1.25 → "1.25", 1.5 → "1.5", 0.30 → "0.3", 20 → "20". */
export function fmtNum(v: number, digits = 2): string {
  return String(Number(v.toFixed(digits)));
}

/** The denoise range the pipeline runs with auto-denoise on: saved start/end, or the defaults. */
export function denoiseRange(lb: LoopbackSettings): Ramp {
  return { start: lb.denoiseStart ?? DENOISE_START_DEFAULT, end: lb.denoiseEnd ?? DENOISE_END_DEFAULT };
}

/** True when a ramp goes down over the rounds (first round higher than the last). */
export function isFalling(r: Ramp): boolean {
  return r.start > r.end;
}

/** A dual-handle slider holds [low, high]; `falling` says which end is the first round. */
export function rampFromHandles(lo: number, hi: number, falling: boolean): Ramp {
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  return falling ? { start: b, end: a } : { start: a, end: b };
}

export function handlesOf(r: Ramp): [number, number] {
  return [Math.min(r.start, r.end), Math.max(r.start, r.end)];
}

// ── patches: each returns the whole LoopbackSettings to save (other fields kept) ──────────

export function patch(lb: LoopbackSettings, p: Partial<LoopbackSettings>): LoopbackSettings {
  return { ...lb, ...p };
}

export function setEnabled(lb: LoopbackSettings, enabled: boolean): LoopbackSettings {
  return patch(lb, { enabled });
}

export function setRounds(lb: LoopbackSettings, n: number): LoopbackSettings {
  return patch(lb, { iterations: clampRounds(n) });
}

export function setGrow(lb: LoopbackSettings, v: number): LoopbackSettings {
  return patch(lb, { upscale: clampTo(v, GROW_MIN, GROW_MAX, GROW_STEP) });
}

export function setDenoise(lb: LoopbackSettings, v: number): LoopbackSettings {
  return patch(lb, { denoise: clampTo(v, DENOISE_MIN, DENOISE_MAX, DENOISE_STEP) });
}

/** "Same every round" on = the single `denoise`; off = the start→end range (saved ends kept). */
export function setSameEveryRound(lb: LoopbackSettings, same: boolean): LoopbackSettings {
  if (same) return patch(lb, { autoDenoise: false });
  const r = denoiseRange(lb);
  return patch(lb, { autoDenoise: true, denoiseStart: r.start, denoiseEnd: r.end });
}

export function setDenoiseRange(lb: LoopbackSettings, r: Ramp): LoopbackSettings {
  return patch(lb, {
    autoDenoise: true,
    denoiseStart: clampTo(r.start, DENOISE_MIN, DENOISE_MAX, DENOISE_STEP),
    denoiseEnd: clampTo(r.end, DENOISE_MIN, DENOISE_MAX, DENOISE_STEP),
  });
}

export function setSteps(lb: LoopbackSettings, v: number): LoopbackSettings {
  return patch(lb, { steps: clampTo(v, STEPS_MIN, STEPS_MAX, 1) });
}

export function setCfg(lb: LoopbackSettings, v: number): LoopbackSettings {
  return patch(lb, { cfg: clampTo(v, CFG_MIN, CFG_MAX, CFG_STEP) });
}

export function setNoise(lb: LoopbackSettings, v: number): LoopbackSettings {
  return patch(lb, { noise: clampTo(v, NOISE_MIN, NOISE_MAX, NOISE_STEP) });
}

/** Set or clear one ramp; the other ramps stay. Clearing the last one drops the `ramps` key. */
export function setRamp(lb: LoopbackSettings, key: LoopbackRampKey, r: Ramp | undefined): LoopbackSettings {
  const ramps = { ...lb.ramps };
  if (r) ramps[key] = r; else delete ramps[key];
  const next = patch(lb, { ramps });
  if (Object.keys(ramps).length === 0) delete next.ramps;
  return next;
}

/** Turn a ramp on from the fixed value: first round = the fixed value, last round = `toward`. */
export function rampFromFixed(fixed: number, toward: number): Ramp {
  return { start: fixed, end: toward };
}

/**
 * The ramp a "changes per round" chip starts with: the first round keeps the fixed value, the last
 * round moves the usual way (a little more grow, fewer steps, lower CFG, noise fading to none).
 */
export function defaultRamp(lb: LoopbackSettings, key: LoopbackRampKey): Ramp {
  switch (key) {
    case 'upscale': return rampFromFixed(lb.upscale, clampTo(lb.upscale + 0.25, GROW_MIN, GROW_MAX, GROW_STEP));
    case 'steps': return rampFromFixed(lb.steps, clampTo(Math.round(lb.steps / 2), STEPS_MIN, STEPS_MAX, 1));
    case 'cfg': return rampFromFixed(lb.cfg, clampTo(lb.cfg - 2, CFG_MIN, CFG_MAX, CFG_STEP));
    case 'noise': return rampFromFixed(clampTo(lb.noise || 0.2, NOISE_MIN, NOISE_MAX, NOISE_STEP), 0);
  }
}

/** Frame path off, the saved frame kept (the classic UI draws it; this card only switches it). */
export function setFrameEnabled(lb: LoopbackSettings, enabled: boolean): LoopbackSettings {
  if (!lb.frame) return lb;
  return patch(lb, { frame: { ...lb.frame, enabled } });
}

// ── labels ─────────────────────────────────────────────────────────────────────────────────

const arrow = (r: Ramp, digits = 2) => `${fmtNum(r.start, digits)}→${fmtNum(r.end, digits)}`;

/** The header line while On: "×4 · grow 1.5 · denoise 0.5→0.3" (+ "steps 20→10", "noise 0.2"). */
export function loopbackSummary(lb: LoopbackSettings): string {
  const rounds = clampRounds(lb.iterations);
  const grow = lb.ramps?.upscale ? arrow(lb.ramps.upscale) : fmtNum(lb.upscale);
  const denoise = lb.autoDenoise ? arrow(denoiseRange(lb)) : fmtNum(lb.denoise);
  const parts = [`×${rounds}`, `grow ${grow}`, `denoise ${denoise}`];
  if (lb.ramps?.steps) parts.push(`steps ${arrow(lb.ramps.steps, 0)}`);
  if (lb.ramps?.cfg) parts.push(`cfg ${arrow(lb.ramps.cfg, 1)}`);
  const noise = lb.ramps?.noise ? arrow(lb.ramps.noise) : lb.noise && lb.noise > 0 ? fmtNum(lb.noise) : '';
  if (noise) parts.push(`noise ${noise}`);
  if (lb.frame?.enabled) parts.push('frame');
  return parts.join(' · ');
}

/** "1024 → 2048 px": the longest side of the base image and of the last round. */
export function growLabel(width: number, height: number, final: readonly [number, number] | undefined): string {
  const base = Math.max(width, height);
  const end = final ? Math.max(final[0], final[1]) : base;
  return `${base} → ${end} px`;
}

/** "first round 0.6 → last round 0.3", for the range rows. */
export function rampLabel(r: Ramp, digits = 2): string {
  return `${fmtNum(r.start, digits)} → ${fmtNum(r.end, digits)}`;
}
