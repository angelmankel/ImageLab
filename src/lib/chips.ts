/**
 * Settings as chips (the new workspace, `features/next`): every parameter is one chip that reads
 * `Name value`, filled when it differs from its default. The formatting and the search filter are
 * plain data in here; the React parts are in `features/next/Chips.tsx`. Imports nothing, so the
 * tests load it from source.
 */

export interface ChipLike {
  id: string;
  label: string;
  /** More words the search box should find it by. */
  keywords?: readonly string[];
}

/** Chips whose label or keywords contain every word of the query; an empty query keeps all. */
export function filterChips<T extends ChipLike>(chips: readonly T[], query: string): T[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [...chips];
  return chips.filter(c => {
    const text = [c.label, ...(c.keywords ?? [])].join(' ').toLowerCase();
    return terms.every(t => text.includes(t));
  });
}

/** `1024×768` */
export const fmtSize = (w: number, h: number) => `${w}×${h}`;

/** A short aspect name for a size: 1:1, 4:3, 16:9, 9:16…; the reduced ratio otherwise. */
export function aspectLabel(w: number, h: number): string {
  if (!(w > 0) || !(h > 0)) return '';
  const named: Array<[number, number, string]> = [
    [1, 1, '1:1'], [4, 3, '4:3'], [3, 4, '3:4'], [3, 2, '3:2'], [2, 3, '2:3'], [16, 9, '16:9'], [9, 16, '9:16'],
    [21, 9, '21:9'], [9, 21, '9:21'], [5, 4, '5:4'], [4, 5, '4:5'],
  ];
  // SDXL's buckets only approximate their ratios (1216×832 is 1.46, not 1.5), so the nearest name
  // within 4 % wins.
  const r = w / h;
  let best: { name: string; err: number } | null = null;
  for (const [a, b, name] of named) {
    const err = Math.abs(r / (a / b) - 1);
    if (err < 0.04 && (!best || err < best.err)) best = { name, err };
  }
  if (best) return best.name;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** A number without float noise: 7, 7.5, 0.35. */
export function fmtNum(n: number, maxDigits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(maxDigits)));
}

/** A file name without its path and model extension, shortened for a chip. */
export function shortModel(name: string | undefined | null, max = 22): string {
  if (!name) return 'none';
  const base = name.replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i, '');
  return base.length > max ? `${base.slice(0, max - 1)}…` : base;
}

/** The sampler and scheduler as one chip value: `euler · karras`. */
export const fmtSampling = (sampler: string, scheduler: string) => `${sampler} · ${scheduler}`;

/** What the image chips read from the workflow. Structural, so the tests pass plain objects. */
export interface ImageChipSource {
  checkpoints: ReadonlyArray<{ name: string }>;
  vae: string;
  loras: ReadonlyArray<{ on: boolean }>;
  embeddings?: ReadonlyArray<{ on: boolean }>;
  width: number;
  height: number;
  batch: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  clipSkip?: number;
  denoise: number;
  inputImage: { width: number; height: number } | null;
  inputDenoise: number;
  loopback?: { enabled: boolean; iterations: number };
  /** Passes that are on (already counted by the caller: `listedPasses` is not pure-importable). */
  passCount: number;
}

export type ImageChipId =
  | 'checkpoint' | 'vae' | 'loras' | 'embeddings' | 'quality'
  | 'size' | 'batch'
  | 'steps' | 'cfg' | 'sampling' | 'clipSkip' | 'denoise'
  | 'input' | 'strength'
  | 'loopback' | 'passes';

export interface ChipReading { value: string; changed: boolean }

/**
 * Every image chip's text and whether it differs from `defaults` (the fresh workflow merged with
 * the model type's own start values). `qualityOn` / `qualityTotal` come from the model profile.
 */
export function imageChipValues(
  w: ImageChipSource,
  defaults: Pick<ImageChipSource, 'width' | 'height' | 'batch' | 'steps' | 'cfg' | 'sampler' | 'scheduler' | 'clipSkip' | 'denoise' | 'vae'>,
  quality: { on: number; total: number } = { on: 0, total: 0 },
): Record<ImageChipId, ChipReading> {
  const loras = w.loras.filter(l => l.on).length;
  const embeddings = (w.embeddings ?? []).filter(e => e.on).length;
  const clip = w.clipSkip ?? -2;
  const lb = w.loopback;
  return {
    checkpoint: { value: shortModel(w.checkpoints[0]?.name), changed: !!w.checkpoints[0]?.name },
    vae: { value: w.vae ? shortModel(w.vae) : 'built-in', changed: w.vae !== (defaults.vae ?? '') && !!w.vae },
    loras: { value: loras ? String(loras) : 'none', changed: loras > 0 },
    embeddings: { value: embeddings ? String(embeddings) : 'none', changed: embeddings > 0 },
    quality: { value: quality.total ? `${quality.on}/${quality.total}` : 'n/a', changed: quality.on > 0 },
    size: { value: `${fmtSize(w.width, w.height)} · ${aspectLabel(w.width, w.height)}`, changed: w.width !== defaults.width || w.height !== defaults.height },
    batch: { value: `×${w.batch}`, changed: w.batch !== defaults.batch },
    steps: { value: String(w.steps), changed: w.steps !== defaults.steps },
    cfg: { value: fmtNum(w.cfg), changed: Math.abs(w.cfg - defaults.cfg) > 1e-9 },
    sampling: { value: fmtSampling(w.sampler, w.scheduler), changed: w.sampler !== defaults.sampler || w.scheduler !== defaults.scheduler },
    clipSkip: { value: clip === -1 ? 'off' : String(clip), changed: clip !== (defaults.clipSkip ?? -2) },
    denoise: { value: fmtNum(w.denoise), changed: Math.abs(w.denoise - defaults.denoise) > 1e-9 },
    input: { value: w.inputImage ? `${fmtSize(w.inputImage.width, w.inputImage.height)} · img2img` : 'none', changed: !!w.inputImage },
    strength: { value: fmtNum(w.inputDenoise), changed: !!w.inputImage },
    loopback: { value: lb?.enabled ? `×${lb.iterations}` : 'off', changed: !!lb?.enabled },
    passes: { value: w.passCount ? String(w.passCount) : 'none', changed: w.passCount > 0 },
  };
}

/** A ComfyUI widget's value as a chip reads it: numbers plain, booleans on / off, text shortened. */
export function formatParamValue(p: { type: string; seedLike?: boolean }, value: unknown, max = 24): string {
  if (value == null || value === '') return '—';
  if (p.type === 'BOOLEAN') return value ? 'on' : 'off';
  if (typeof value === 'number') return p.seedLike ? String(value) : fmtNum(value, 4);
  const s = String(value).replace(/\s+/g, ' ').trim();
  const base = p.type === 'COMBO' ? s.replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf|png|jpe?g|webp)$/i, '') : s;
  return base.length > max ? `${base.slice(0, max - 1)}…` : base || '—';
}
