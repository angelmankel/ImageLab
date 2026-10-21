/**
 * FIXLIST-2 #53: pure rules for the ComfyUI screen's workflows list (no React, no stores; tested
 * in tests/comfyWorkflowList.test.cjs): what kind of workflow a graph is (the row's type badge),
 * the short one-line meta, search, sort, and unique copy names.
 */
export type WorkflowType = 'image' | 'video' | 'upscale' | 'other';
/** The list's order (FIXLIST-2 late item: A–Z by default, so opening one never moves it). */
export type WorkflowSort = 'name' | 'name-desc' | 'used' | 'modified' | 'nodes';
export const WORKFLOW_SORTS: ReadonlyArray<{ id: WorkflowSort; label: string }> = [
  { id: 'name', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'used', label: 'Recently used' },
  { id: 'modified', label: 'Recently modified' },
  { id: 'nodes', label: 'Node count' },
];
/** A saved sort that is not one of today's (an old 'recent') reads as the default, A–Z. */
export const sortOf = (v: unknown): WorkflowSort => (WORKFLOW_SORTS.some((x) => x.id === v) ? (v as WorkflowSort) : 'name');
/** Kind filter: every workflow, or one type. */
export type WorkflowShow = 'all' | WorkflowType;

const VIDEO = /(^|_)(Wan|LTXV|Hunyuan|Mochi|Cosmos|MiniMaxH3|AnimateDiff|ADE_|VHS_)|Video|SaveAnimated|CreateVideo/i;
const UPSCALE = /Upscale(Model|WithModel)|UltimateSDUpscale|ImageUpscale|LatentUpscale|SUPIR|SeedVR/i;
const SAMPLE = /KSampler|SamplerCustom|SamplerAdvanced/i;
const NEW_LATENT = /^Empty(SD3|Hunyuan|Mochi|LTXV|Cosmos)?Latent|EmptyLatentImage|EmptyFlux/i;
const IMAGE_OUT = /SaveImage|PreviewImage/i;

/** Every node type in an editor workflow, subgraphs included. */
export function nodeTypes(wf: unknown): string[] {
  const out: string[] = [];
  const add = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) { const t = (n as { type?: unknown })?.type; if (typeof t === 'string') out.push(t); }
  };
  add((wf as { nodes?: unknown })?.nodes);
  const subs = (wf as { definitions?: { subgraphs?: unknown } })?.definitions?.subgraphs;
  if (Array.isArray(subs)) for (const s of subs) add((s as { nodes?: unknown })?.nodes);
  return out;
}

/** Video when any node makes video; upscale when it upscales without starting from an empty latent; image when it samples or saves images. */
export function workflowType(wf: unknown): WorkflowType {
  const types = nodeTypes(wf);
  if (!types.length) return 'other';
  if (types.some((t) => VIDEO.test(t))) return 'video';
  const ups = types.some((t) => UPSCALE.test(t));
  const fresh = types.some((t) => NEW_LATENT.test(t));
  if (ups && !fresh) return 'upscale';
  if (types.some((t) => SAMPLE.test(t) || IMAGE_OUT.test(t))) return 'image';
  return ups ? 'upscale' : 'other';
}

/** "now", "4m", "3h", "2d", "5w". */
export function shortAgo(at: number, now: number): string {
  if (!at) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d` : `${Math.round(d / 7)}w`;
}

/** The row's meta: "9 nodes · 4m" (used, else saved). `short` drops the word "nodes" (phone). */
export function rowMeta(nodes: number | null, usedAt: number, savedAt: number, now: number, short = false): string {
  const parts: string[] = [];
  if (nodes) parts.push(short ? String(nodes) : `${nodes} node${nodes === 1 ? '' : 's'}`);
  const t = shortAgo(usedAt || savedAt, now);
  if (t) parts.push(t);
  return parts.join(' · ');
}

export interface ListRow { name: string; path: string; usedAt: number; savedAt: number; nodes?: number | null; type?: WorkflowType | null }

/**
 * Filter (words of the name / folder, any order; a kind) then sort. Names compare naturally and
 * case-insensitively ("test2" before "test10"); every other order falls back to A–Z for ties.
 */
export function shownRows<T extends ListRow>(rows: readonly T[], query: string, sort: WorkflowSort, show: WorkflowShow = 'all'): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = rows.filter((r) => (show === 'all' || (r.type ?? 'other') === show) && words.every((w) => r.path.toLowerCase().includes(w)));
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.path.localeCompare(b.path);
  const cmp: Record<WorkflowSort, (a: T, b: T) => number> = {
    name: byName,
    'name-desc': (a, b) => byName(b, a),
    used: (a, b) => (b.usedAt - a.usedAt) || byName(a, b),
    modified: (a, b) => (b.savedAt - a.savedAt) || byName(a, b),
    nodes: (a, b) => ((b.nodes ?? -1) - (a.nodes ?? -1)) || byName(a, b),
  };
  return hit.sort(cmp[sort]);
}

/** Candidate file names for a copy: "x (copy).json", "x (copy 2).json", … (in the same folder). */
export function copyNames(path: string, max = 20): string[] {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  const base = path.slice(slash + 1).replace(/\.json$/i, '');
  return Array.from({ length: max }, (_, i) => `${dir}${base} (copy${i ? ` ${i + 1}` : ''}).json`);
}

/** A typed name → a path in the same folder as `from` ("wip/a.json" + "b" → "wip/b.json"). Null when empty or unchanged. */
export function renamedPath(from: string, typed: string): string | null {
  const name = typed.trim().replace(/\.json$/i, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const slash = from.lastIndexOf('/');
  const to = `${slash >= 0 ? from.slice(0, slash + 1) : ''}${name}.json`;
  return to === from ? null : to;
}
