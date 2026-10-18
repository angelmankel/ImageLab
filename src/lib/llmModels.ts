/**
 * Pure helpers for the local-LLM model manager (Ollama + Hugging Face GGUF repos).
 * Imports nothing, so `tests/llm-models.test.cjs` can load it straight from source.
 */

/** One file from Hugging Face's `/api/models/{id}/tree/main?recursive=true`. */
export type HfTreeFile = { path: string; size?: number; type?: string };

/** One downloadable quantization of a GGUF repo. A split model (`-00001-of-00003.gguf`) is one
 *  choice whose size is the sum of its parts. */
export type GgufChoice = { quant: string; bytes: number; files: string[] };

// Longest names first so `Q4_K_M` wins over `Q4_K`, and `IQ4_XS` over `Q4`.
const QUANT_RE = /(?:^|[-_.])((?:I?Q[1-8](?:_[0-9])?(?:_K)?(?:_[XSML]{1,2})?)|BF16|F16|F32|MXFP4)(?=[-_.]|$)/i;

/** The quantization label in a GGUF file name (`…-Q4_K_M.gguf` → `Q4_K_M`), upper-cased;
 *  null when there is none. */
export function ggufQuant(fileName: string): string | null {
  const base = fileName.split('/').pop() ?? fileName;
  const m = base.replace(/-\d{5}-of-\d{5}(?=\.gguf$)/i, '').replace(/\.gguf$/i, '').match(QUANT_RE);
  return m ? m[1].toUpperCase() : null;
}

/** Vision projectors ride along with their model; never a choice of their own. */
export function isProjector(fileName: string): boolean {
  return /(^|\/)mmproj|projector/i.test(fileName);
}

/** The quant choices in a repo tree, smallest first. Files without a quant label are skipped. */
export function ggufChoices(files: HfTreeFile[]): GgufChoice[] {
  const byQuant = new Map<string, GgufChoice>();
  for (const f of files) {
    if (f.type && f.type !== 'file') continue;
    if (!/\.gguf$/i.test(f.path) || isProjector(f.path)) continue;
    const quant = ggufQuant(f.path);
    if (!quant) continue;
    const c = byQuant.get(quant) ?? { quant, bytes: 0, files: [] };
    c.bytes += f.size ?? 0;
    c.files.push(f.path);
    byQuant.set(quant, c);
  }
  return [...byQuant.values()].sort((a, b) => a.bytes - b.bytes);
}

/** The name Ollama pulls a Hugging Face GGUF quant by. */
export function hfPullName(repoId: string, quant: string): string {
  return `hf.co/${repoId}:${quant}`;
}

export type VramFit = 'fits' | 'tight' | 'too-big';

/** Will a model of `bytes` run fully on a GPU of `vramGb`? The weights plus ~15% and 1 GB for the
 *  context and runtime must fit; within 2 GB over it still runs, partly on the CPU (slow). */
export function vramFit(bytes: number, vramGb: number): VramFit {
  if (!bytes || !vramGb) return 'fits';
  const needGb = (bytes * 1.15) / 2 ** 30 + 1;
  if (needGb <= vramGb) return 'fits';
  if (needGb <= vramGb + 2) return 'tight';
  return 'too-big';
}

/** One line of `/api/pull`'s NDJSON stream. */
export type PullProgress = { status: string; completed?: number; total?: number; error?: string };

export function parsePullLine(line: string): PullProgress | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t);
    if (o && typeof o === 'object') return o as PullProgress;
  } catch { /* half a line — the caller buffers */ }
  return null;
}

/** A readable label for an Ollama model name: `hf.co/bartowski/x-GGUF:Q6_K` → `x · Q6_K`,
 *  `huihui_ai/qwen3-abliterated:8b` → `qwen3-abliterated · 8b`. */
export function modelLabel(name: string): string {
  const [path, tag] = name.split(':');
  let base = path.split('/').pop() ?? path;
  base = base.replace(/[-_.]?GGUF$/i, '');
  return tag && tag !== 'latest' ? `${base} · ${tag}` : base;
}

/** Drop `<think>…</think>` blocks a reasoning model may still put in its answer. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const gb = bytes / 2 ** 30;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 2 ** 20)} MB`;
}
