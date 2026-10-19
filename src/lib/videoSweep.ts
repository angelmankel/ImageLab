/**
 * "Vary one setting across N runs": the quickest way to learn what a knob does to a Wan video. A
 * sweep is a list of settings patches, each with a label for the result it makes; the video run
 * store plays them one after another (`features/video/videoSweep.ts`). The seed is held fixed
 * across the runs, unless the seed is the axis, so the only difference between two results is the
 * one setting.
 *
 * Imports only `./wanGraph` (which imports nothing), so the tests load it from source.
 */
import { defaultVideoSettings, type VideoSettings } from './wanGraph';

export type SweepAxis = 'seed' | 'cfg' | 'shift' | 'steps' | 'switchStep' | 'length' | 'fastStrength' | 'motionSteps' | 'nagScale' | 'loraStrength';

export interface SweepAxisInfo {
  id: SweepAxis;
  label: string;
  min: number;
  max: number;
  step: number;
  /** A sensible first range. */
  from: number;
  to: number;
  /** When the axis is only meaningful with Fast on or off. */
  needsFast?: boolean;
}

export const SWEEP_AXES: readonly SweepAxisInfo[] = [
  { id: 'seed', label: 'Seed', min: 0, max: 1e15, step: 1, from: 0, to: 3 },
  { id: 'cfg', label: 'CFG', min: 1, max: 10, step: 0.5, from: 2, to: 5, needsFast: false },
  { id: 'shift', label: 'Shift', min: 1, max: 16, step: 0.5, from: 3, to: 10 },
  { id: 'steps', label: 'Steps', min: 2, max: 60, step: 1, from: 10, to: 30, needsFast: false },
  { id: 'switchStep', label: 'Switch step', min: 0, max: 60, step: 1, from: 4, to: 14, needsFast: false },
  { id: 'length', label: 'Frames', min: 5, max: 161, step: 4, from: 33, to: 81 },
  { id: 'fastStrength', label: 'lightx2v strength', min: 0, max: 1.5, step: 0.05, from: 0.6, to: 1, needsFast: true },
  { id: 'motionSteps', label: 'Motion pass steps', min: 0, max: 8, step: 1, from: 0, to: 3, needsFast: true },
  { id: 'nagScale', label: 'NAG scale', min: 0, max: 30, step: 0.5, from: 5, to: 15 },
  { id: 'loraStrength', label: 'First LoRA strength', min: 0, max: 2, step: 0.05, from: 0.4, to: 1.2 },
];

export interface SweepItem {
  label: string;
  patch: Partial<VideoSettings>;
}

/** `count` values from `from` to `to`, evenly spaced, rounded to `step`, no duplicates. */
export function sweepValues(from: number, to: number, count: number, step: number): number[] {
  const n = Math.max(1, Math.round(count));
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const raw = n === 1 ? from : from + ((to - from) * i) / (n - 1);
    const v = Number((Math.round(raw / step) * step).toFixed(decimals));
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));

/**
 * The runs of a sweep over `axis`, each a patch on `base`. Settings the axis implies are set too:
 * sweeping CFG or steps turns Fast off (Fast fixes both); sweeping the lightx2v strength turns it
 * on; sweeping NAG turns NAG on. The seed stays `base.seed` unless it is the axis.
 */
export function sweepItems(base: VideoSettings, axis: SweepAxis, from: number, to: number, count: number): SweepItem[] {
  const info = SWEEP_AXES.find((a) => a.id === axis);
  if (!info) return [];
  if (axis === 'seed') {
    const n = Math.max(1, Math.round(count));
    const start = Math.max(0, Math.trunc(from));
    return Array.from({ length: n }, (_, i) => ({ label: `seed ${start + i}`, patch: { seed: start + i } }));
  }
  const values = sweepValues(from, to, count, info.step);
  return values.map((v) => {
    const label = `${info.label} ${fmt(v)}`;
    switch (axis) {
      case 'cfg': return { label, patch: { fast: false, cfg: v } };
      case 'shift': return { label, patch: { shift: v, shiftLow: null } };
      case 'steps': return { label, patch: { fast: false, steps: v, switchStep: Math.min(v, Math.round(v * (base.switchStep / Math.max(1, base.steps)))) } };
      case 'switchStep': return { label, patch: { fast: false, switchStep: Math.min(v, base.steps) } };
      case 'length': return { label, patch: { length: v } };
      case 'fastStrength': {
        const fr = { ...defaultVideoSettings().fastRecipe, ...(base.fastRecipe ?? {}) };
        return { label, patch: { fast: true, fastRecipe: { ...fr, strengthHigh: v, strengthLow: v } } };
      }
      case 'motionSteps': {
        const fr = { ...defaultVideoSettings().fastRecipe, ...(base.fastRecipe ?? {}) };
        return { label, patch: { fast: true, fastRecipe: { ...fr, motionSteps: v } } };
      }
      case 'nagScale': return { label, patch: { guidance: { ...base.guidance, nag: { ...base.guidance.nag, on: true, scale: v } } } };
      case 'loraStrength': {
        const i = base.loras.findIndex((l) => l.on);
        if (i < 0) return { label, patch: {} };
        return { label, patch: { loras: base.loras.map((l, j) => (j === i ? { ...l, strength: v, strengthLow: null } : l)) } };
      }
      default: return { label, patch: {} };
    }
  });
}
