/**
 * Pure helpers for the ComfyUI screen (rule 14): queue rows out of ComfyUI's `/queue`, log lines
 * out of the bus's events, the status line out of `/system_stats`, workflow-file checks.
 * Imports nothing (types only), so `tests/comfy.test.cjs` loads this very file.
 */

// ─── Queue ──────────────────────────────────────────────────────────────────

/** One row of the queue panel. */
export interface QueueRow {
  /** ComfyUI prompt id. */
  id: string;
  /** ComfyUI's queue number (lower runs first). */
  number: number;
  state: 'running' | 'pending';
  /** What it is: a known job's name, else the model the graph loads, else "Prompt #n". */
  label: string;
  /** Seed the graph samples with, when it has one. */
  seed: number | null;
  /** The API graph, kept to name nodes in the log and the progress line. */
  graph: Record<string, unknown>;
}

type ApiNodeLike = { class_type?: unknown; inputs?: Record<string, unknown>; _meta?: { title?: unknown } };

const LOADER_KEYS = ['ckpt_name', 'unet_name', 'model_name'];
const SEED_KEYS = ['seed', 'noise_seed'];

const stripExt = (s: string) => s.replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i, '');

function nodesOf(graph: Record<string, unknown>): ApiNodeLike[] {
  return Object.values(graph).filter((n): n is ApiNodeLike => !!n && typeof n === 'object');
}

/** A readable name for a graph: the model it loads (file name without folder or extension). */
export function graphLabel(graph: Record<string, unknown>): string | null {
  for (const n of nodesOf(graph)) {
    for (const k of LOADER_KEYS) {
      const v = n.inputs?.[k];
      if (typeof v === 'string' && v) return stripExt(v);
    }
  }
  return null;
}

/** The first literal seed in the graph (a KSampler's `seed`, a noise node's `noise_seed`). */
export function graphSeed(graph: Record<string, unknown>): number | null {
  for (const n of nodesOf(graph)) {
    for (const k of SEED_KEYS) {
      const v = n.inputs?.[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return null;
}

/** A node's display name: its title, else its class, else "node <id>". */
export function nodeName(graph: Record<string, unknown> | null | undefined, nodeId: string | null): string {
  if (!nodeId) return '';
  const n = graph?.[nodeId] as ApiNodeLike | undefined;
  const title = n?._meta?.title;
  if (typeof title === 'string' && title) return title;
  if (typeof n?.class_type === 'string' && n.class_type) return n.class_type;
  return `node ${nodeId}`;
}

/**
 * ComfyUI's `/queue` → rows, running first, then pending in run order. Each item is
 * `[number, prompt_id, graph, extra, outputs]`. `names` labels prompts this app queued itself.
 */
export function queueRows(raw: unknown, names: Record<string, string> = {}): QueueRow[] {
  const json = (raw ?? {}) as { queue_running?: unknown; queue_pending?: unknown };
  const map = (arr: unknown, state: QueueRow['state']): QueueRow[] => {
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((e): QueueRow[] => {
      if (!Array.isArray(e)) return [];
      const id = String(e[1] ?? '');
      if (!id) return [];
      const number = Number(e[0]);
      const graph = e[2] && typeof e[2] === 'object' ? (e[2] as Record<string, unknown>) : {};
      const label = names[id] || graphLabel(graph) || `Prompt #${Number.isFinite(number) ? number : '?'}`;
      return [{ id, number: Number.isFinite(number) ? number : 0, state, label, seed: graphSeed(graph), graph }];
    });
  };
  const pending = map(json.queue_pending, 'pending').sort((a, b) => a.number - b.number);
  return [...map(json.queue_running, 'running'), ...pending];
}

/** Live progress of the running prompt, from the bus. */
export interface LiveProgress { promptId: string; node: string | null; value: number; max: number }

/** "KSampler · 12/30" for the running row; '' when nothing is known yet. */
export function progressText(row: QueueRow, live: LiveProgress | null): string {
  if (!live || live.promptId !== row.id) return 'starting';
  const name = nodeName(row.graph, live.node);
  if (live.max > 0) return `${name ? `${name} · ` : ''}${live.value}/${live.max}`;
  return name || 'running';
}

/** 0..1 for the running row's bar. */
export function progressFraction(row: QueueRow, live: LiveProgress | null): number {
  if (!live || live.promptId !== row.id || live.max <= 0) return 0;
  return Math.max(0, Math.min(1, live.value / live.max));
}

/** "queued · seed 8841" (or "queued" when the graph has no literal seed). */
export function pendingDetail(row: QueueRow, position: number): string {
  const pos = position > 0 ? `#${position} in line` : 'queued';
  return row.seed == null ? pos : `${pos} · seed ${row.seed}`;
}

// ─── Log ────────────────────────────────────────────────────────────────────

/** A bus event, typed structurally (same shape as `ComfyEvent` in lib/comfyBus.ts), plus open/close. */
export type LogEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'binary' }
  | { type: 'progress'; value: number; max: number; node: string | null; promptId: string }
  | { type: 'executing'; promptId: string; node: string | null }
  | { type: 'execution_start'; promptId: string }
  | { type: 'execution_cached'; promptId: string; nodes: string[] }
  | { type: 'executed'; promptId: string; node: string; images: unknown[] }
  | { type: 'execution_error'; promptId: string; message: string }
  | { type: 'execution_success'; promptId: string }
  | { type: 'status'; queueRemaining: number };

export type LogTone = 'dim' | 'info' | 'ok' | 'warn' | 'err';

export interface LogLine {
  at: number;
  text: string;
  tone: LogTone;
  /** Lines with the same non-empty key replace each other when consecutive (progress ticks, queue depth). */
  key?: string;
}

const shortId = (id: string) => (id ? id.slice(0, 8) : '?');

/** `12:04:11` in local time. */
export function clock(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * One bus event → one log line (or null for events not worth a line: preview frames, the
 * "executing nothing" that ends a run). `graphOf` names nodes when the prompt's graph is known.
 */
export function logLine(ev: LogEvent, at: number, graphOf: (promptId: string) => Record<string, unknown> | null = () => null): LogLine | null {
  switch (ev.type) {
    case 'open': return { at, text: 'connected', tone: 'dim' };
    case 'close': return { at, text: 'disconnected', tone: 'warn' };
    case 'binary': return null;
    case 'status': return { at, text: `queue ${ev.queueRemaining}`, tone: 'dim', key: 'status' };
    case 'execution_start': return { at, text: `got prompt ${shortId(ev.promptId)}`, tone: 'info' };
    case 'execution_cached':
      return ev.nodes.length ? { at, text: `cached ${ev.nodes.length} node${ev.nodes.length === 1 ? '' : 's'}`, tone: 'dim' } : null;
    case 'executing':
      return ev.node ? { at, text: `running ${nodeName(graphOf(ev.promptId), ev.node)}`, tone: 'info' } : null;
    case 'progress': {
      const name = nodeName(graphOf(ev.promptId), ev.node) || 'step';
      const pct = ev.max > 0 ? Math.round((ev.value / ev.max) * 100) : 0;
      return { at, text: `${name} ${ev.value}/${ev.max} · ${pct}%`, tone: 'info', key: `progress:${ev.promptId}:${ev.node ?? ''}` };
    }
    case 'executed': {
      const n = ev.images.length;
      return n ? { at, text: `${nodeName(graphOf(ev.promptId), ev.node)} saved ${n} file${n === 1 ? '' : 's'}`, tone: 'info' } : null;
    }
    case 'execution_success': return { at, text: `done ${shortId(ev.promptId)}`, tone: 'ok' };
    case 'execution_error': return { at, text: `error: ${ev.message}`, tone: 'err' };
    default: return null;
  }
}

/** Append a line, collapsing a run of same-key lines into the newest one, and keep the last `max`. */
export function appendLog(lines: readonly LogLine[], line: LogLine, max = 300): LogLine[] {
  const last = lines[lines.length - 1];
  const base = line.key && last?.key === line.key ? lines.slice(0, -1) : lines;
  const next = [...base, line];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The log as plain text for Copy. */
export function logText(lines: readonly LogLine[]): string {
  return lines.map((l) => `[${clock(l.at)}] ${l.text}`).join('\n');
}

// ─── Server status ──────────────────────────────────────────────────────────

/** "cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync" → "RTX 4090"; "cuda:0 NVIDIA B200 : …" → "B200". */
export function gpuName(device: string): string {
  return device
    .replace(/^\s*\w+:\d+\s+/, '')
    .replace(/\s*:.*$/, '')
    .replace(/^NVIDIA\s+/i, '')
    .replace(/^GeForce\s+/i, '')
    .trim();
}

export interface ServerStats { gpu: string | null; vramTotal: number; vramFree: number; version: string | null }

/** `/system_stats` → the bits the status line shows. */
export function readStats(raw: unknown): ServerStats {
  const j = (raw ?? {}) as { system?: { comfyui_version?: unknown }; devices?: Array<{ name?: unknown; vram_total?: unknown; vram_free?: unknown }> };
  const dev = Array.isArray(j.devices) ? j.devices[0] : undefined;
  const version = typeof j.system?.comfyui_version === 'string' ? j.system.comfyui_version : null;
  return {
    gpu: typeof dev?.name === 'string' ? gpuName(dev.name) || null : null,
    vramTotal: Number(dev?.vram_total) || 0,
    vramFree: Number(dev?.vram_free) || 0,
    version,
  };
}

/** "This pod · B200 · ComfyUI 0.3.75" — the parts that are known. */
export function statusLine(serverName: string, stats: ServerStats | null, online: boolean): string {
  if (!online) return `${serverName} · offline`;
  return [serverName, stats?.gpu, stats?.version ? `ComfyUI ${stats.version}` : null].filter(Boolean).join(' · ');
}

/** "18.2 / 79.6 GB" of VRAM in use. */
export function vramText(stats: ServerStats | null): string {
  if (!stats || !stats.vramTotal) return '';
  const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
  return `${gb(stats.vramTotal - stats.vramFree)} / ${gb(stats.vramTotal)} GB`;
}

// ─── Workflows ──────────────────────────────────────────────────────────────

const NOT_NODES = new Set(['Note', 'MarkdownNote']);

/** Nodes in an editor workflow (notes do not count). 0 when it is not an editor workflow. */
export function editorNodeCount(wf: unknown): number {
  const nodes = (wf as { nodes?: unknown })?.nodes;
  if (!Array.isArray(nodes)) return 0;
  return nodes.filter((n) => !NOT_NODES.has(String((n as { type?: unknown })?.type ?? ''))).length;
}

/** What a JSON file holds: an editor workflow (`nodes` + `links`), an API graph, or neither. */
export function workflowKind(json: unknown): 'editor' | 'api' | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  if (Array.isArray((json as { nodes?: unknown }).nodes)) return 'editor';
  const vals = Object.values(json);
  if (vals.length && vals.every((v) => !!v && typeof v === 'object' && typeof (v as { class_type?: unknown }).class_type === 'string')) return 'api';
  return null;
}

/** A safe file name under ComfyUI's workflows folder: "My flow (v2).json" stays, slashes go. */
export function workflowFileName(name: string): string {
  const base = name.replace(/\.json$/i, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${base || 'workflow'}.json`;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function ago(at: number, now: number): string {
  if (!at) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** The row's second line: "12 nodes · used 2 min ago" / "saved 3 d ago". */
export function workflowDetail(nodes: number | null, usedAt: number, savedAt: number, now: number): string {
  const parts: string[] = [];
  if (nodes) parts.push(`${nodes} node${nodes === 1 ? '' : 's'}`);
  if (usedAt) parts.push(`used ${ago(usedAt, now)}`);
  else if (savedAt) parts.push(`saved ${ago(savedAt, now)}`);
  return parts.join(' · ');
}

/** ComfyUI reports file times in seconds (some builds in ms): always ms. */
export function epochMs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  return t < 1e12 ? Math.round(t * 1000) : t;
}
