/**
 * Item 30: what the viewer's Details tab shows for one result, pure (tested in
 * tests/viewer.test.cjs). Reads a history entry — its prompt, seed, model and the workflow +
 * prompt-layer snapshot captured at queue time — into display rows: models (checkpoints with merge
 * ratios, LoRAs with strengths, embeddings, VAE), parameters (only the ones that apply: denoise
 * for img2img, clip skip when set, Loopback when on…) and the file facts.
 */
import type { HistoryEntry } from '@/lib/types';

export interface ModelRow { name: string; file: string; role: string; strength?: number; clip?: number }
export interface ParamRow { label: string; value: string; mono?: boolean }
export interface EntryMeta {
  prompt: string;
  negative: string;
  checkpoints: ModelRow[];
  loras: ModelRow[];
  embeddings: ModelRow[];
  vae: string | null;
  modelType: string | null;
  params: ParamRow[];
  img2img: boolean;
}

/** "sdxl/waiIllustrious_v140.safetensors" → "waiIllustrious_v140". */
export function shortName(file: string): string {
  return (file.split(/[\\/]/).pop() || file).replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i, '');
}

/** 8400 → "8.4 s"; 72000 → "1 m 12 s"; under a second → "0.4 s". */
export function formatDuration(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return r ? `${m} m ${r} s` : `${m} m`;
}

const num = (n: number, d = 2) => String(Number(n.toFixed(d)));

export function describeEntry(entry: Pick<HistoryEntry, 'positive' | 'negative' | 'seed' | 'model' | 'workflow'>): EntryMeta {
  const w = entry.workflow;
  const checkpoints: ModelRow[] = w?.checkpoints?.length
    ? w.checkpoints.map((c, i) => ({ name: shortName(c.name), file: c.name, role: i === 0 ? 'Checkpoint' : `Merged · ${Math.round(c.ratio * 100)}%` }))
    : entry.model ? [{ name: shortName(entry.model), file: entry.model, role: 'Checkpoint' }] : [];
  const loras: ModelRow[] = (w?.loras ?? []).filter((l) => l.on && l.name).map((l) => ({ name: shortName(l.name), file: l.name, role: 'LoRA', strength: l.strength, clip: l.clipStrength }));
  const embeddings: ModelRow[] = (w?.embeddings ?? []).filter((e) => e.on && e.name).map((e) => ({ name: shortName(e.name), file: e.name, role: e.target === 'negative' ? 'Embedding · negative' : 'Embedding', strength: e.strength }));
  const img2img = !!w?.inputImage;
  const params: ParamRow[] = [{ label: 'Seed', value: String(entry.seed ?? '—'), mono: true }];
  if (w) {
    params.push({ label: 'Steps', value: String(w.steps) });
    params.push({ label: 'CFG', value: num(w.cfg, 2) });
    if (w.sampler) params.push({ label: 'Sampler', value: w.sampler });
    if (w.scheduler) params.push({ label: 'Scheduler', value: w.scheduler });
    params.push({ label: 'Size', value: `${w.width}×${w.height}` });
    if (img2img) params.push({ label: 'Denoise', value: num(w.inputDenoise, 2) });
    if (typeof w.clipSkip === 'number' && w.clipSkip < -1) params.push({ label: 'Clip skip', value: String(-w.clipSkip) });
    if (w.loopback?.enabled && w.loopback.iterations > 0) params.push({ label: 'Loopback', value: `${w.loopback.iterations} × ${num(w.loopback.upscale, 2)}` });
    if (w.batch > 1) params.push({ label: 'Batch', value: String(w.batch) });
  }
  return {
    prompt: entry.positive ?? '',
    negative: entry.negative ?? '',
    checkpoints, loras, embeddings,
    vae: w?.vae ? shortName(w.vae) : null,
    modelType: w?.modelProfile || null,
    params,
    img2img,
  };
}
