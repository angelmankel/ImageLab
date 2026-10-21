/**
 * The model viewer's pure layer (no React, no DOM): a server file name → its CivitAI ids through
 * the main app's hash cache, a sample's generation `meta` → the ordered key/value rows of the
 * "This sample" grid, the licence chips of a model, and the small formatters (dates as
 * "12 Mar 2026", short hashes). Tested in `tests/modelViewer.test.cjs`.
 */
import { findModelHash } from '@/lib/modelHash';
import type { ModelHash } from '@/lib/comfy';
import type { CivitaiCacheEntry, CivitaiVersionByHash, CivitaiImageMeta, CivitaiModel } from '@/lib/civitai';

// ── { file } → CivitAI ids ─────────────────────────────────────────────────

export interface ResolvedFile { modelId: number; versionId: number }

/**
 * A ComfyUI file name (`SDXL/foo.safetensors`, `easynegative`) → the CivitAI model + version it
 * was hashed to. `null` when the file is not hashed, the lookup has not resolved, or CivitAI does
 * not know it (`fileLookupState` tells which).
 */
export function resolveFileTarget(file: string, hashes: ModelHash[], civitaiByHash: Record<string, CivitaiCacheEntry>): ResolvedFile | null {
  const h = findModelHash(hashes, file);
  if (!h) return null;
  const entry = civitaiByHash[h.hash];
  if (!entry || entry.status !== 'found' || !entry.data) return null;
  const d = entry.data as Partial<CivitaiVersionByHash>;
  if (typeof d.modelId !== 'number' || typeof d.id !== 'number') return null;
  return { modelId: d.modelId, versionId: d.id };
}

export type FileLookupState = 'unhashed' | 'pending' | 'not-on-civitai' | 'error' | 'found';

/** What the viewer should say about a file that did not resolve: still looking, or really unknown. */
export function fileLookupState(file: string, hashes: ModelHash[], civitaiByHash: Record<string, CivitaiCacheEntry>): FileLookupState {
  const h = findModelHash(hashes, file);
  if (!h) return hashes.length ? 'unhashed' : 'pending';
  const entry = civitaiByHash[h.hash];
  if (!entry) return 'pending';
  if (entry.status === 'found') return entry.data ? 'found' : 'error';
  return entry.status === 'not-found' ? 'not-on-civitai' : 'error';
}

/** `checkpoints/SDXL/foo.safetensors` → "checkpoints"; a bare name → ''. */
export function folderOfKey(key: string | undefined | null): string {
  if (!key) return '';
  const i = key.indexOf('/');
  return i > 0 ? key.slice(0, i) : '';
}

/**
 * A `by-hash` version shaped as a model list item, so a `{ file }` target has a name, type,
 * stats and sample images to show at once, before (or without) the full /models/:id payload.
 */
export function modelFromVersion(v: CivitaiVersionByHash, fallbackName: string): CivitaiModel {
  return {
    id: v.modelId,
    name: v.model?.name ?? fallbackName,
    description: null,
    type: v.model?.type ?? 'Other',
    nsfw: !!v.model?.nsfw,
    tags: [],
    allowNoCredit: true, allowCommercialUse: [], allowDerivatives: true, allowDifferentLicense: true,
    creator: { username: '', image: null },
    stats: v.stats ?? { downloadCount: 0, thumbsUpCount: 0, thumbsDownCount: 0, commentCount: 0 },
    modelVersions: [v],
    nsfwLevel: Math.max(0, ...(v.images ?? []).map((i) => i.nsfwLevel ?? 0)),
    poi: v.model?.poi,
  };
}

// ── generation meta → rows ─────────────────────────────────────────────────

export type MetaRow = [label: string, value: string];

/** The keys that have their own place (prompt boxes, the named rows) and never show as "other". */
const KNOWN: Array<{ label: string; keys: string[] }> = [
  { label: 'Sampler', keys: ['sampler', 'Sampler'] },
  { label: 'Scheduler', keys: ['scheduler', 'Scheduler', 'Schedule type', 'Schedule'] },
  { label: 'Steps', keys: ['steps', 'Steps'] },
  { label: 'CFG', keys: ['cfgScale', 'cfg', 'CFG scale', 'CFG'] },
  { label: 'Seed', keys: ['seed', 'Seed'] },
  { label: 'Size', keys: ['Size', 'size'] },
  { label: 'Clip skip', keys: ['clipSkip', 'Clip skip', 'clip_skip'] },
  { label: 'Denoise', keys: ['Denoising strength', 'denoise', 'denoising_strength'] },
  { label: 'Model', keys: ['Model', 'model'] },
  { label: 'Model hash', keys: ['Model hash', 'modelHash'] },
  { label: 'VAE', keys: ['VAE', 'vae'] },
  { label: 'Hires upscaler', keys: ['Hires upscaler'] },
  { label: 'Hires steps', keys: ['Hires steps'] },
  { label: 'Hires upscale', keys: ['Hires upscale'] },
  { label: 'Version', keys: ['Version', 'version'] },
];
const HIDDEN = new Set(['prompt', 'negativePrompt', 'resources', 'civitaiResources', 'hashes', 'comfy', 'workflow', 'extraMetadata', 'Hashes']);

function text(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.name === 'string') return [o.name, o.type ? `(${String(o.type)})` : '', o.weight != null ? `×${String(o.weight)}` : ''].filter(Boolean).join(' ');
    try { const s = JSON.stringify(v); return s.length > 120 ? `${s.slice(0, 117)}…` : s; } catch { return ''; }
  }
  return '';
}

/**
 * The ordered rows of a sample's generation data: the named ones first (Sampler, Scheduler,
 * Steps, CFG, Seed, Size, Clip skip, …) in a fixed order, then every other `meta` key as it
 * comes, except the prompts (shown in their own boxes) and the structured blobs
 * (`resources` → `metaResources`, `hashes` → `metaHashes`). Empty values are skipped.
 */
export function metaRows(meta: CivitaiImageMeta | null | undefined): MetaRow[] {
  if (!meta) return [];
  const used = new Set<string>();
  const rows: MetaRow[] = [];
  for (const k of KNOWN) {
    for (const key of k.keys) {
      if (!(key in meta)) continue;
      used.add(key);
      const v = text(meta[key]);
      if (v && !rows.some(([l]) => l === k.label)) rows.push([k.label, v]);
    }
  }
  for (const key of Object.keys(meta)) {
    if (used.has(key) || HIDDEN.has(key)) continue;
    const v = text(meta[key]);
    if (v) rows.push([key, v]);
  }
  return rows;
}

export interface MetaResource { name: string; type: string; weight?: number; hash?: string }

/** The `resources` / `civitaiResources` lists (LoRAs, embeddings, the checkpoint) in one shape. */
export function metaResources(meta: CivitaiImageMeta | null | undefined): MetaResource[] {
  if (!meta) return [];
  const out: MetaResource[] = [];
  const push = (r: unknown) => {
    if (!r || typeof r !== 'object') return;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : typeof o.modelName === 'string' ? o.modelName : typeof o.modelVersionName === 'string' ? o.modelVersionName : '';
    const type = typeof o.type === 'string' ? o.type : '';
    const idName = o.modelVersionId != null ? `version ${String(o.modelVersionId)}` : '';
    if (!name && !idName) return;
    const res: MetaResource = { name: name || idName, type };
    if (typeof o.weight === 'number') res.weight = o.weight;
    if (typeof o.hash === 'string') res.hash = o.hash;
    out.push(res);
  };
  for (const key of ['resources', 'civitaiResources'] as const) {
    const list = meta[key];
    if (Array.isArray(list)) for (const r of list) push(r);
  }
  return out;
}

/** The `hashes` / `Hashes` map ("model: abc123, lora:foo: def456") as rows. */
export function metaHashes(meta: CivitaiImageMeta | null | undefined): MetaRow[] {
  if (!meta) return [];
  const h = (meta.hashes ?? meta.Hashes) as unknown;
  if (!h || typeof h !== 'object') return [];
  return Object.entries(h as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, String(v)] as MetaRow);
}

/** A value worth a copy button: anything hash-looking, ids and seeds. */
export function isCopyable(label: string, value: string): boolean {
  if (/hash|seed|^id$| id$/i.test(label)) return true;
  return /^[0-9a-f]{8,64}$/i.test(value);
}

// ── formatters ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Mar 2026"; '' when there is no usable date. */
export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The first `n` characters of a hash, upper-cased (CivitAI prints AutoV2 as 10 upper hex). */
export function shortHash(hash: string | undefined | null, n = 10): string {
  return (hash ?? '').trim().slice(0, n).toUpperCase();
}

/** The hashes of a file in a fixed order, SHA256 first (that is the one the servers compare). */
export function fileHashRows(hashes: Partial<Record<string, string | undefined>> | undefined | null): MetaRow[] {
  if (!hashes) return [];
  const order = ['SHA256', 'AutoV2', 'AutoV1', 'BLAKE3', 'CRC32'];
  const keys = Object.keys(hashes).sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  return keys.filter((k) => hashes[k]).map((k) => [k, hashes[k] as string]);
}

/**
 * The gallery with the tapped preview's picture first (the preview setting chose it): moved to
 * the front when the gallery has it (same `keyOf`), else put in front of it. No start → as is.
 */
export function withStartImage<T extends { url: string }>(items: T[], start: T | null | undefined, keyOf: (url: string) => string): T[] {
  if (!start?.url) return items;
  const k = keyOf(start.url);
  const i = items.findIndex((x) => keyOf(x.url) === k);
  if (i === 0) return items;
  if (i > 0) return [items[i], ...items.slice(0, i), ...items.slice(i + 1)];
  return [start, ...items];
}

/**
 * ALL of a version's pictures (fix list 2 item 28): the creator's own samples (the model
 * payload's `version.images`, shown first) and then the community gallery from /images (paged by
 * cursor), each picture once. A sample that the gallery also has is swapped for the gallery's copy
 * in place (that one carries the generation `meta`), so loading more pages never moves a picture
 * that is already shown.
 */
export function mergeGallery<T extends { url: string }>(samples: readonly T[], gallery: readonly T[], keyOf: (url: string) => string): T[] {
  const byKey = new Map<string, T>();
  for (const g of gallery) { const k = keyOf(g.url); if (!byKey.has(k)) byKey.set(k, g); }
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of samples) {
    const k = keyOf(s.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(byKey.get(k) ?? s);
  }
  for (const g of gallery) {
    const k = keyOf(g.url);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
  }
  return out;
}

/** "3 / 40+" while more pages exist, "3 / 128" once the last page is in; '' for none. */
export function counterText(index: number, count: number, hasMore: boolean): string {
  return count > 0 ? `${index + 1} / ${count}${hasMore ? '+' : ''}` : '';
}

/** `i` kept inside `[0, len)`; 0 for an empty list. */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(i)), len - 1);
}

// ── preloading ─────────────────────────────────────────────────────────────

/**
 * The indices to keep decoded around `index`, nearest first: the current one, then +1, −1, +2,
 * −2 … out to `radius`, only those inside `[0, length)`.
 */
export function neighbourOrder(index: number, length: number, radius = 2): number[] {
  const out: number[] = [];
  const push = (i: number) => { if (i >= 0 && i < length && !out.includes(i)) out.push(i); };
  push(index);
  for (let d = 1; d <= radius; d++) { push(index + d); push(index - d); }
  return out;
}

/** Is `index` within `within` of the last item, so the next page should load now? */
export function nearEnd(index: number, length: number, within = 3): boolean {
  if (length <= 0) return false;
  return index >= length - 1 - within;
}

// ── licence chips ──────────────────────────────────────────────────────────

export interface LicenceChip { label: string; ok?: boolean; tone?: 'ember' | 'muted' }

/** The same facts the Models detail shows, as one list: what the licence allows and the flags. */
export function licenceChips(m: {
  allowCommercialUse?: string[] | null; allowNoCredit?: boolean; allowDerivatives?: boolean; allowDifferentLicense?: boolean;
  poi?: boolean; nsfw?: boolean;
}, earlyAccess: boolean): LicenceChip[] {
  const commercial = m.allowCommercialUse ?? [];
  const out: LicenceChip[] = [];
  if (earlyAccess) out.push({ label: 'Early access', tone: 'ember' });
  out.push({ label: 'Commercial', ok: commercial.includes('Image') });
  out.push({ label: 'Rent', ok: commercial.includes('Rent') || commercial.includes('RentCivit') });
  out.push({ label: 'Sell', ok: commercial.includes('Sell') });
  out.push({ label: m.allowNoCredit ? 'No credit needed' : 'Credit required' });
  out.push({ label: m.allowDerivatives === false ? 'No derivatives' : 'Derivatives' , ok: m.allowDerivatives !== false });
  if (m.allowDifferentLicense === false) out.push({ label: 'Same licence only' });
  if (m.poi) out.push({ label: 'Real person', tone: 'muted' });
  if (m.nsfw) out.push({ label: 'NSFW', tone: 'muted' });
  return out;
}
