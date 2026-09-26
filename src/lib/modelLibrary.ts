/**
 * "My models" — the list of every model the user downloaded through the app, kept on their
 * device so a fresh pod can be refilled from it.
 *
 * Pure functions only (no runtime imports): the node tests transpile this file and run it in a
 * bare `vm` context. The store (`features/library/store.ts`) owns persistence.
 *
 * Privacy: what is written to the device, and to export files, is only the links (version id,
 * CivitAI page and download URL) and the user's own marks (stars, note, dates) — see
 * `privateEntry`. Names, pictures, sizes and hashes are looked up again when the list is shown
 * and live in memory only.
 *
 * Entries are keyed by CivitAI model *version* id — that is all a re-download needs; the rest is
 * for showing the list nicely and for matching it against what a server already has.
 */
import type { CivitaiModelVersion, CivitaiVersionByHash } from './civitai';

/** Bump when the export format changes shape; older files are migrated in `validateLibraryFile`. */
export const MODEL_LIBRARY_VERSION = 1;

export type ModelLibraryCatalog = 'civitai' | 'red';

export type ModelLibraryEntry = {
  versionId: number;
  /** Parent model id; 0 when it could not be looked up (the version id still re-downloads). */
  modelId: number;
  modelName: string;
  versionName: string;
  /** CivitAI model type string: "Checkpoint", "LORA", "TextualInversion", "VAE", "Upscaler", … */
  type: string;
  baseModel: string;
  fileName: string;
  sizeKB: number;
  /** Lowercase SHA256 of the primary file, '' when CivitAI did not give one. */
  sha256: string;
  thumbnailUrl: string;
  pageUrl: string;
  downloadUrl: string;
  /** Which CivitAI host the metadata came from, when known. */
  catalog?: ModelLibraryCatalog;
  /** First time it was recorded (ms since epoch). */
  addedAt: number;
  /** Last time a download was started (ms since epoch). */
  lastDownloadedAt: number;
  /** 0 = unrated, 1–5 stars. */
  rating: number;
  note: string;
};

/** The part of an entry that is written down: links and the user's own marks, nothing that names the model. */
export type PrivateLibraryEntry = Pick<ModelLibraryEntry,
  'versionId' | 'modelId' | 'catalog' | 'pageUrl' | 'downloadUrl' | 'addedAt' | 'lastDownloadedAt' | 'rating' | 'note'>;

export type ModelLibraryFile = {
  app: 'imagelab';
  kind: 'model-library';
  version: number;
  exportedAt: string;
  entries: PrivateLibraryEntry[];
};

/** The bits of a CivitAI model the list needs — both the full model and the by-version payload fit. */
export type CivitaiModelInfo = { id: number; name: string; type: string };

export const NOTE_MAX = 280;

// ── building entries ────────────────────────────────────────────────────────

export function civitaiPageUrl(modelId: number, versionId: number, catalog?: ModelLibraryCatalog): string {
  const host = catalog === 'red' ? 'civitai.red' : 'civitai.com';
  if (!modelId) return `https://${host}/model-versions/${versionId}`;
  return `https://${host}/models/${modelId}?modelVersionId=${versionId}`;
}

function primary(version: CivitaiModelVersion) {
  const files = version.files ?? [];
  return files.find((f) => f.primary) ?? files[0] ?? null;
}

/** First still preview: CivitAI galleries mix in videos, which an <img> cannot show. */
function firstStill(version: CivitaiModelVersion): string {
  for (const img of version.images ?? []) {
    const kind = (img as { type?: string }).type;
    if (!img?.url || kind === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(img.url)) continue;
    return img.url;
  }
  return '';
}

/** A fresh entry (unrated, no note) from CivitAI data. */
export function entryFromCivitai(
  model: CivitaiModelInfo | null,
  version: CivitaiModelVersion,
  now: number,
  catalog?: ModelLibraryCatalog,
): ModelLibraryEntry {
  const file = primary(version);
  const modelId = model?.id ?? (version as { modelId?: number }).modelId ?? 0;
  return {
    versionId: version.id,
    modelId,
    modelName: model?.name ?? '',
    versionName: version.name ?? '',
    type: model?.type ?? '',
    baseModel: version.baseModel ?? '',
    fileName: file?.name ?? '',
    sizeKB: file?.sizeKB ?? 0,
    sha256: (file?.hashes?.SHA256 ?? '').toLowerCase(),
    thumbnailUrl: firstStill(version),
    pageUrl: civitaiPageUrl(modelId, version.id, catalog),
    downloadUrl: file?.downloadUrl ?? '',
    catalog,
    addedAt: now,
    lastDownloadedAt: now,
    rating: 0,
    note: '',
  };
}

/** The smallest entry that still re-downloads — used when CivitAI could not be reached. */
export function bareEntry(versionId: number, now: number): ModelLibraryEntry {
  return {
    versionId, modelId: 0, modelName: '', versionName: '', type: '', baseModel: '', fileName: '',
    sizeKB: 0, sha256: '', thumbnailUrl: '', pageUrl: civitaiPageUrl(0, versionId), downloadUrl: '',
    addedAt: now, lastDownloadedAt: now, rating: 0, note: '',
  };
}

/** True when the entry lacks the metadata a CivitAI lookup would fill in. */
export function needsDetails(e: ModelLibraryEntry): boolean {
  return !e.modelName || !e.modelId;
}

export function displayName(e: ModelLibraryEntry): string {
  return e.modelName || e.fileName || `Version ${e.versionId}`;
}

// ── updating ───────────────────────────────────────────────────────────────

const META_KEYS = [
  'modelId', 'modelName', 'versionName', 'type', 'baseModel', 'fileName', 'sizeKB', 'sha256',
  'thumbnailUrl', 'pageUrl', 'downloadUrl', 'catalog',
] as const;

/** `primary`'s metadata, with any field it lacks taken from `other`. */
function fillMeta(primaryEntry: ModelLibraryEntry, other: ModelLibraryEntry): ModelLibraryEntry {
  const out = { ...primaryEntry } as Record<string, unknown>;
  const src = other as unknown as Record<string, unknown>;
  for (const k of META_KEYS) {
    if (!out[k] && src[k]) out[k] = src[k];
  }
  // A bare page URL (no model id) is worth replacing once the model id is known.
  if (primaryEntry.modelId === 0 && other.modelId) out.pageUrl = other.pageUrl;
  return out as ModelLibraryEntry;
}

/**
 * Record a download: add the entry, or refresh an existing one's metadata and bump its
 * last-downloaded time. The first-added time, rating and note are the user's and stay.
 */
export function recordEntry(list: ModelLibraryEntry[], incoming: ModelLibraryEntry, now: number): ModelLibraryEntry[] {
  const i = list.findIndex((e) => e.versionId === incoming.versionId);
  if (i < 0) return [...list, { ...incoming, addedAt: now, lastDownloadedAt: now }];
  const old = list[i];
  const next = fillMeta({ ...incoming, addedAt: old.addedAt, rating: old.rating, note: old.note }, old);
  next.lastDownloadedAt = Math.max(now, old.lastDownloadedAt);
  const out = list.slice();
  out[i] = next;
  return out;
}

/** Fill in metadata for an entry that was recorded bare, without touching its timestamps. */
export function applyDetails(list: ModelLibraryEntry[], details: ModelLibraryEntry): ModelLibraryEntry[] {
  const i = list.findIndex((e) => e.versionId === details.versionId);
  if (i < 0) return list;
  const old = list[i];
  const out = list.slice();
  out[i] = { ...fillMeta(details, old), addedAt: old.addedAt, lastDownloadedAt: old.lastDownloadedAt, rating: old.rating, note: old.note };
  return out;
}

/** Star click: clicking the current rating again clears it. */
export function nextRating(current: number, clicked: number): number {
  return current === clicked ? 0 : clampRating(clicked);
}

function clampRating(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(0, Math.min(5, v));
}

export function setRating(list: ModelLibraryEntry[], versionId: number, rating: number): ModelLibraryEntry[] {
  return list.map((e) => (e.versionId === versionId ? { ...e, rating: clampRating(rating) } : e));
}

export function setNote(list: ModelLibraryEntry[], versionId: number, note: string): ModelLibraryEntry[] {
  const clean = note.trim().slice(0, NOTE_MAX);
  return list.map((e) => (e.versionId === versionId ? { ...e, note: clean } : e));
}

export function removeEntries(list: ModelLibraryEntry[], versionIds: Iterable<number>): ModelLibraryEntry[] {
  const drop = new Set(versionIds);
  return list.filter((e) => !drop.has(e.versionId));
}

/**
 * Merge an imported list into the current one, by version id. Timestamps keep the widest span
 * (earliest added, latest downloaded); metadata comes from whichever side downloaded last, with
 * gaps filled from the other; an existing rating / note stays unless the imported one is set.
 */
export function mergeEntries(
  current: ModelLibraryEntry[],
  incoming: ModelLibraryEntry[],
): { entries: ModelLibraryEntry[]; added: number; updated: number } {
  const out = current.slice();
  const index = new Map(out.map((e, i) => [e.versionId, i]));
  let added = 0;
  let updated = 0;
  for (const inc of incoming) {
    const i = index.get(inc.versionId);
    if (i === undefined) {
      index.set(inc.versionId, out.length);
      out.push({ ...inc });
      added++;
      continue;
    }
    const old = out[i];
    const newer = inc.lastDownloadedAt > old.lastDownloadedAt ? inc : old;
    const merged: ModelLibraryEntry = {
      ...fillMeta(newer, newer === inc ? old : inc),
      addedAt: Math.min(old.addedAt || inc.addedAt, inc.addedAt || old.addedAt),
      lastDownloadedAt: Math.max(old.lastDownloadedAt, inc.lastDownloadedAt),
      rating: inc.rating > 0 ? inc.rating : old.rating,
      note: inc.note ? inc.note : old.note,
    };
    if (JSON.stringify(merged) !== JSON.stringify(old)) updated++;
    out[i] = merged;
  }
  return { entries: out, added, updated };
}

// ── export / import ────────────────────────────────────────────────────────

export function exportLibrary(entries: ModelLibraryEntry[], now: number): ModelLibraryFile {
  return {
    app: 'imagelab',
    kind: 'model-library',
    version: MODEL_LIBRARY_VERSION,
    exportedAt: new Date(now).toISOString(),
    entries: entries.map(privateEntry),
  };
}

export function privateEntry(e: ModelLibraryEntry): PrivateLibraryEntry {
  const out: PrivateLibraryEntry = {
    versionId: e.versionId, modelId: e.modelId, pageUrl: e.pageUrl, downloadUrl: e.downloadUrl,
    addedAt: e.addedAt, lastDownloadedAt: e.lastDownloadedAt, rating: e.rating, note: e.note,
  };
  if (e.catalog) out.catalog = e.catalog;
  return out;
}

/** An entry from a cached `by-hash` lookup (a model file some server already has). */
export function entryFromHashLookup(data: CivitaiVersionByHash, now: number): ModelLibraryEntry {
  return entryFromCivitai({ id: data.modelId, name: data.model?.name ?? '', type: data.model?.type ?? '' }, data, now, 'civitai');
}

/**
 * Add the models installed on the servers that the list does not have yet. `found` is the
 * CivitAI by-hash data for the servers' model files. Existing entries are left alone.
 */
export function seedEntries(
  list: ModelLibraryEntry[], found: CivitaiVersionByHash[], now: number,
): { entries: ModelLibraryEntry[]; added: number } {
  const have = new Set(list.map((e) => e.versionId));
  const fresh: ModelLibraryEntry[] = [];
  for (const d of found) {
    if (!d?.id || have.has(d.id)) continue;
    have.add(d.id);
    fresh.push(entryFromHashLookup(d, now));
  }
  return fresh.length ? { entries: [...list, ...fresh], added: fresh.length } : { entries: list, added: 0 };
}

/** `imagelab-models-YYYY-MM-DD.json`, in local time — the day the user sees on their clock. */
export function exportFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `imagelab-models-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const id = (v: unknown): number => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
};
const time = (v: unknown): number => {
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  return num(v);
};

/** One untrusted object → an entry, or null when it has no usable version id. */
export function normalizeEntry(raw: unknown): ModelLibraryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const versionId = id(r.versionId);
  if (!versionId) return null;
  const modelId = id(r.modelId);
  const catalog = r.catalog === 'red' || r.catalog === 'civitai' ? r.catalog : undefined;
  const addedAt = time(r.addedAt);
  const lastDownloadedAt = time(r.lastDownloadedAt) || addedAt;
  const pageUrl = str(r.pageUrl);
  return {
    versionId,
    modelId,
    modelName: str(r.modelName, 300),
    versionName: str(r.versionName, 300),
    type: str(r.type, 60),
    baseModel: str(r.baseModel, 60),
    fileName: str(r.fileName, 400),
    sizeKB: num(r.sizeKB),
    sha256: /^[0-9a-f]{64}$/i.test(str(r.sha256)) ? str(r.sha256).toLowerCase() : '',
    thumbnailUrl: /^https?:\/\//i.test(str(r.thumbnailUrl)) ? str(r.thumbnailUrl) : '',
    pageUrl: /^https?:\/\//i.test(pageUrl) ? pageUrl : civitaiPageUrl(modelId, versionId, catalog),
    downloadUrl: /^https?:\/\//i.test(str(r.downloadUrl)) ? str(r.downloadUrl) : '',
    catalog,
    addedAt: addedAt || lastDownloadedAt,
    lastDownloadedAt,
    rating: clampRating(r.rating),
    note: str(r.note, NOTE_MAX),
  };
}

export type ImportResult =
  | { ok: true; entries: ModelLibraryEntry[]; skipped: number }
  | { ok: false; error: string };

/**
 * Check an imported file (already JSON-parsed) and turn it into entries. Accepts the export
 * format, or a bare array of entries. Bad rows are skipped and counted; a file with none usable
 * is an error. Duplicate version ids inside the file are merged.
 */
export function validateLibraryFile(data: unknown): ImportResult {
  let rows: unknown;
  if (Array.isArray(data)) rows = data;
  else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.kind !== undefined && d.kind !== 'model-library') {
      return { ok: false, error: 'This is not an ImageLab model list.' };
    }
    if (d.version !== undefined) {
      if (typeof d.version !== 'number' || !Number.isFinite(d.version)) {
        return { ok: false, error: 'The file has an unreadable version.' };
      }
      if (d.version > MODEL_LIBRARY_VERSION) {
        return { ok: false, error: `This list was saved by a newer ImageLab (format ${d.version}). Update the app and try again.` };
      }
    }
    rows = d.entries;
  } else {
    return { ok: false, error: 'This is not an ImageLab model list.' };
  }
  if (!Array.isArray(rows)) return { ok: false, error: 'The file has no list of models ("entries").' };

  let entries: ModelLibraryEntry[] = [];
  let skipped = 0;
  for (const row of rows) {
    const e = normalizeEntry(row);
    if (!e) { skipped++; continue; }
    entries = mergeEntries(entries, [e]).entries;
  }
  if (entries.length === 0 && rows.length > 0) {
    return { ok: false, error: 'None of the models in this file have a CivitAI version id.' };
  }
  return { ok: true, entries, skipped };
}

/** Parse text from a file (or localStorage). */
export function parseLibraryText(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  return validateLibraryFile(data);
}

// ── viewing ────────────────────────────────────────────────────────────────

export type LibrarySort = 'added' | 'name' | 'rating';

export type LibraryQuery = { search: string; type: string; sort: LibrarySort };

/** Search (name, version, file, base model, note), type filter, then sort. */
export function viewEntries(list: ModelLibraryEntry[], q: LibraryQuery): ModelLibraryEntry[] {
  const words = q.search.toLowerCase().split(/\s+/).filter(Boolean);
  const out = list.filter((e) => {
    if (q.type && e.type !== q.type) return false;
    if (words.length === 0) return true;
    const hay = `${e.modelName} ${e.versionName} ${e.fileName} ${e.baseModel} ${e.note}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const byName = (a: ModelLibraryEntry, b: ModelLibraryEntry) =>
    displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base', numeric: true })
    || a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
  if (q.sort === 'name') out.sort(byName);
  else if (q.sort === 'rating') out.sort((a, b) => b.rating - a.rating || b.addedAt - a.addedAt);
  else out.sort((a, b) => b.addedAt - a.addedAt || byName(a, b));
  return out;
}

/** Distinct types in the list, for the filter. */
export function libraryTypes(list: ModelLibraryEntry[]): string[] {
  return [...new Set(list.map((e) => e.type).filter(Boolean))].sort();
}

/** Friendly label for a CivitAI type string. */
export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    Checkpoint: 'Checkpoint', LORA: 'LoRA', LoCon: 'LyCORIS', DoRA: 'DoRA',
    TextualInversion: 'Embedding', Hypernetwork: 'Hypernetwork', VAE: 'VAE', Upscaler: 'Upscaler',
    Controlnet: 'ControlNet', MotionModule: 'Motion', AestheticGradient: 'Aesthetic', Poses: 'Poses',
    Wildcards: 'Wildcards', Workflows: 'Workflow', Detection: 'Detection', Other: 'Other',
  };
  return map[type] ?? (type || 'Unknown');
}

export function formatSizeKB(kb: number): string {
  if (!kb) return '';
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GB`;
  if (kb >= 1024) return `${Math.round(kb / 1024)} MB`;
  return `${Math.round(kb)} KB`;
}

/** Swap CivitAI's `/width=N/` path segment for a smaller thumbnail. Other URLs pass through. */
export function thumbUrl(url: string, width: number): string {
  if (!url) return url;
  return url.replace(/\/width=\d+\//, `/width=${Math.max(64, Math.round(width))}/`);
}

// ── installed? ─────────────────────────────────────────────────────────────

/** Server model lists that can hold a downloaded file (not samplers / schedulers). */
const NOT_MODEL_LISTS = new Set(['samplers', 'schedulers']);

/**
 * Does a server's capability lists contain this file? ComfyUI names can carry a subfolder
 * (`SDXL/foo.safetensors`), CivitAI's never do, so a suffix match counts; embeddings are
 * listed without their extension.
 */
export function serverHasFile(info: Record<string, unknown> | undefined, fileNames: string[]): boolean {
  if (!info) return false;
  const want = fileNames.filter(Boolean);
  if (want.length === 0) return false;
  const bare = want.map((n) => n.replace(/\.[^./]+$/, ''));
  for (const [key, list] of Object.entries(info)) {
    if (NOT_MODEL_LISTS.has(key) || !Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== 'string') continue;
      for (let i = 0; i < want.length; i++) {
        if (item === want[i] || item.endsWith('/' + want[i]) || item === bare[i] || item.endsWith('/' + bare[i])) return true;
      }
    }
  }
  return false;
}

/**
 * File names an entry may be on disk under: its own, plus whatever file the servers' hash index
 * knows by the same SHA256 (a renamed download still counts).
 */
export function knownFileNames(
  e: ModelLibraryEntry,
  hashes: ReadonlyArray<{ hash: string; filename: string }>,
): { names: string[]; hashMatch: boolean } {
  const names = e.fileName ? [e.fileName] : [];
  let hashMatch = false;
  if (e.sha256) {
    for (const h of hashes) {
      if (h.hash?.toLowerCase() !== e.sha256) continue;
      hashMatch = true;
      if (h.filename && !names.includes(h.filename)) names.push(h.filename);
    }
  }
  return { names, hashMatch };
}
