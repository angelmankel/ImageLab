/**
 * The selected-model card's facts (fix list item 16), the pure part: "Creator's samples use" —
 * the typical steps / CFG / sampler / clip skip (median or most common) read from the version's
 * sample images' generation data, and a LoRA's / embedding's usual strength from the samples'
 * `civitaiResources` (the entry whose `modelVersionId` is this version). Only what the samples
 * actually say: an unknown value stays undefined, never a guess.
 * Imports nothing, so `tests/cardFacts.test.cjs` loads it from source.
 */

export interface SampleMeta { [key: string]: unknown }

export interface Recommended {
  steps?: number;
  cfg?: number;
  sampler?: string;
  clipSkip?: number;
  /** The weight the samples load this version at (LoRA / embedding). */
  strength?: number;
  /** How many samples had generation data. */
  from: number;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim()) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function median(xs: readonly number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The most common value; ties go to the one seen first. */
export function mode<T>(xs: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestN = 0;
  for (const x of xs) {
    const n = (counts.get(x) ?? 0) + 1;
    counts.set(x, n);
    if (n > bestN) { best = x; bestN = n; }
  }
  return best;
}

const round = (v: number | undefined, step: number) => (v == null ? undefined : Math.round(v / step) * step);

/** What the samples of `versionId` were made with. */
export function recommendFrom(metas: readonly (SampleMeta | null | undefined)[], versionId?: number | null): Recommended {
  const ms = metas.filter((m): m is SampleMeta => !!m && typeof m === 'object');
  const pick = (f: (m: SampleMeta) => number | undefined) => ms.map(f).filter((n): n is number => n != null);
  const steps = median(pick((m) => num(m.steps)).filter((n) => n > 0 && n <= 200));
  const cfg = median(pick((m) => num(m.cfgScale ?? m.cfg)).filter((n) => n > 0 && n <= 30));
  const clipSkip = mode(pick((m) => num(m.clipSkip ?? m['Clip skip'] ?? m.clip_skip)).filter((n) => n >= 1 && n <= 12));
  const sampler = mode(ms.map((m) => (typeof m.sampler === 'string' ? m.sampler.trim() : '')).filter(Boolean));
  const weights: number[] = [];
  if (versionId != null) {
    for (const m of ms) {
      const list = Array.isArray(m.civitaiResources) ? m.civitaiResources : [];
      for (const r of list as Array<Record<string, unknown>>) {
        const w = num(r?.weight);
        if (r && num(r.modelVersionId) === versionId && w != null && w > 0 && w <= 3) weights.push(w);
      }
    }
  }
  return {
    steps: round(steps, 1),
    cfg: round(cfg, 0.5),
    sampler,
    clipSkip,
    strength: round(median(weights), 0.05),
    from: ms.filter((m) => (typeof m.prompt === 'string' && !!m.prompt.trim()) || (num(m.steps) ?? 0) > 0 || (typeof m.sampler === 'string' && !!m.sampler.trim())).length,
  };
}

/** True when there is anything worth a row. */
export const hasRecommended = (r: Recommended): boolean => r.steps != null || r.cfg != null || !!r.sampler || r.clipSkip != null || r.strength != null;

/** "0.8", "1", "1.25" */
export const fmtNum = (v: number): string => String(Number(v.toFixed(2)));
