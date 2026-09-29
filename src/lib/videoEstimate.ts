/**
 * How long a video will take, learned from the runs this browser has watched finish.
 *
 * The runner times every node from ComfyUI's `executing` events. A run is split into parts, each
 * with its own rate, because they scale differently:
 *   - sampling      ∝ width × height × frames × steps × (2 when CFG > 1: CFG runs the model twice)
 *   - upscale model ∝ output pixels × frames, per model
 *   - finish        ∝ output pixels × frames (decode, resize, MP4 encode and save)
 *   - load          the extra time of a run whose models changed; 0 when they stayed loaded
 * ComfyUI loads models lazily, inside the sampler and the decoder, so a "cold" run (other models
 * than the run before) is slow in every part. Rates come from warm runs (same models as the run
 * before) when there are any; the load cost is what cold runs took beyond their warm prediction.
 * Each rate is the median of the recent runs, so one odd run does not throw it. Timings are kept
 * per server: a pod's GPU decides all of it.
 *
 * No runtime imports: the tests load this file on its own.
 */

export type RunTiming = {
  at: number;
  /** Sampling work, in 1e9 px·frame·step (× 2 for CFG > 1). */
  sampleUnits: number;
  samplingMs: number;
  /** Output work, in 1e9 px·frame at the saved size. */
  outUnits: number;
  finishMs: number;
  /** The upscale model this run used, or null. */
  upscaleModel: string | null;
  upscaleMs: number;
  loadMs: number;
  /** Which models were loaded: a run with the same key finds them in memory. */
  modelsKey: string;
};

/** What a run will do, from its settings. */
export type RunShape = {
  width: number;
  height: number;
  frames: number;
  steps: number;
  cfg: number;
  outWidth: number;
  outHeight: number;
  upscaleModel: string | null;
  modelsKey: string;
};

export type Estimate = {
  ms: number;
  parts: { load: number; sampling: number; upscale: number; finish: number };
  /** How many finished runs it is based on. */
  runs: number;
  /** True when a part had no run to learn from and was left out. */
  partial: boolean;
};

export function sampleUnits(r: Pick<RunShape, 'width' | 'height' | 'frames' | 'steps' | 'cfg'>): number {
  return (r.width * r.height * r.frames * r.steps * (r.cfg > 1 ? 2 : 1)) / 1e9;
}

export function outUnits(r: Pick<RunShape, 'outWidth' | 'outHeight' | 'frames'>): number {
  return (r.outWidth * r.outHeight * r.frames) / 1e9;
}

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Runs kept per server. */
export const KEEP_RUNS = 30;
/** Runs a rate is taken over. */
const RECENT = 12;

/**
 * The estimate for `shape`, or null before any run has finished. `lastModelsKey` is the models of
 * the last run on this server: the same key means nothing needs loading.
 */
export function estimateRun(runs: RunTiming[], shape: RunShape, lastModelsKey: string | null): Estimate | null {
  const warmFlags = runs.map((r, i) => i > 0 && runs[i - 1].modelsKey === r.modelsKey);
  const warm = runs.filter((_, i) => warmFlags[i]);
  const cold = runs.filter((_, i) => !warmFlags[i]);
  // Learn the rates from warm runs when there are any; a cold run alone is still better than nothing.
  const pool = (warm.length ? warm : runs).slice(-RECENT);
  const sRate = median(pool.filter((r) => r.sampleUnits > 0).map((r) => r.samplingMs / r.sampleUnits));
  if (sRate == null) return null;
  let partial = false;

  const fRate = median(pool.filter((r) => r.outUnits > 0).map((r) => r.finishMs / r.outUnits)) ?? 0;
  const uRateFor = (model: string) => {
    const same = runs.filter((r, i) => r.upscaleModel === model && r.outUnits > 0 && (warmFlags[i] || !warm.length));
    return median((same.length ? same : runs.filter((r) => r.upscaleModel === model && r.outUnits > 0)).slice(-RECENT).map((r) => r.upscaleMs / r.outUnits));
  };
  let upscale = 0;
  if (shape.upscaleModel) {
    const uRate = uRateFor(shape.upscaleModel);
    if (uRate == null) partial = true; else upscale = uRate * outUnits(shape);
  }
  let load = 0;
  if (shape.modelsKey !== lastModelsKey) {
    if (warm.length) {
      // What cold runs took beyond what the warm rates predict for them.
      const extra = cold.slice(-RECENT).map((r) => {
        const u = r.upscaleModel ? (uRateFor(r.upscaleModel) ?? 0) * r.outUnits : 0;
        const predicted = sRate * r.sampleUnits + fRate * r.outUnits + u;
        return r.samplingMs + r.finishMs + r.upscaleMs + r.loadMs - predicted;
      });
      load = Math.max(0, median(extra) ?? 0);
    } else {
      load = median(runs.map((r) => r.loadMs).filter((ms) => ms > 1500)) ?? 0;
    }
  }
  const parts = { load, sampling: sRate * sampleUnits(shape), upscale, finish: fRate * outUnits(shape) };
  return { ms: parts.load + parts.sampling + parts.upscale + parts.finish, parts, runs: runs.length, partial };
}

/** "18 s", "2 min 5 s" */
export function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}
