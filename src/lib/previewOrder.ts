/**
 * "Model preview starts on" (Settings, `useStore().modelPreviewSource`): the data behind it.
 *
 *  - The **popular** list: a model version's most-reacted pictures from CivitAI's Images API
 *    (`sort=Most Reactions`, every NSFW level, each picture keeping its `nsfwLevel` so the
 *    caller's mask still applies). One request per version, made lazily — only when a caller asks
 *    (`requestPopular`: a picture scrolled into view, a model shown big; three at a time) — never
 *    for every tile on a page at once. Kept in memory and in localStorage
 *    (`imagelab.previewPopular.v1`, newest 200 versions, 7 days; Donny 10-20 picked this over a
 *    server-side cache), so a reload or a new tab on this device asks again for nothing. A failed
 *    request is not retried this page load; the caller simply keeps CivitAI's curated order.
 *  - `orderPreviewImages`: the pure ordering (curated · popular · local history → one list),
 *    built on `orderForPreview` in `modelHash.ts`.
 *  - `historyIndex`: local generations per model file name, for 'history'.
 *
 * The React side is the next UI's `usePreviewOrder` (`next/src/app/usePreviewOrder.ts`).
 */
import { fetchCivitaiImages } from './civitai';
import { orderForPreview } from './modelHash';
import type { ModelPreviewSource } from './storage';
import type { HistoryEntry } from './types';

/** One picture a preview can show. CivitAI's own image objects fit this shape. */
export interface PreviewImage {
  url: string;
  /** 'video' for a clip (the caller turns it into a still with `previewStill`). */
  type?: string;
  /** CivitAI's level — a number from the model payload, a name ('None', 'X'…) from /images. */
  nsfwLevel?: number | string;
  width?: number;
  height?: number;
  /** A local generation (a ComfyUI /view url), not a CivitAI picture. */
  local?: boolean;
}

export const POPULAR_STORE_KEY = 'imagelab.previewPopular.v1';
/** Versions kept in localStorage; the oldest go first. */
export const POPULAR_MAX_VERSIONS = 200;
/** A stored list older than this is fetched again (CivitAI's reactions move slowly). */
export const POPULAR_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Pictures asked for per version: enough for a cover plus a few fallbacks / hover frames. */
export const POPULAR_LIMIT = 12;

export interface PopularEntry { at: number; images: PreviewImage[] }
export type PopularCache = Record<string, PopularEntry>;

// ── pure parts ─────────────────────────────────────────────────────────────

/** The cache key of a model version. */
export function popularKey(versionId: number): string {
  return String(versionId);
}

/**
 * The same CivitAI picture under different urls (`/original=true/…`, `/width=450/…`, the /images
 * API's own name) shares its uuid path segment; that is the key duplicates are dropped by.
 * Anything else is its own url.
 */
export function imageKey(url: string): string {
  const m = url?.match(/^https?:\/\/image\.civitai\.com\/[^/]+\/([^/]+)\//);
  return m ? m[1] : url;
}

type ImageLike = { url?: unknown; type?: unknown; nsfwLevel?: unknown; width?: unknown; height?: unknown } | null | undefined;

/** CivitAI images → what the cache keeps (url, type, level, size). Url-less items are dropped. */
export function toPreviewImages(items: readonly ImageLike[] | null | undefined): PreviewImage[] {
  const out: PreviewImage[] = [];
  for (const it of items ?? []) {
    if (!it || typeof it.url !== 'string' || !it.url) continue;
    const img: PreviewImage = { url: it.url };
    if (typeof it.type === 'string' && it.type) img.type = it.type;
    const lvl = it.nsfwLevel;
    if (typeof lvl === 'number' || typeof lvl === 'string') img.nsfwLevel = lvl;
    if (typeof it.width === 'number') img.width = it.width;
    if (typeof it.height === 'number') img.height = it.height;
    out.push(img);
  }
  return out;
}

/** Read the stored cache, dropping anything malformed — and, given `now`, anything older than `maxAge`. */
export function parsePopularCache(raw: string | null | undefined, now?: number, maxAge = POPULAR_MAX_AGE_MS): PopularCache {
  if (!raw) return {};
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return {}; }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: PopularCache = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    const e = v as Partial<PopularEntry> | null;
    if (!/^\d+$/.test(k) || !e || typeof e.at !== 'number' || !Array.isArray(e.images)) continue;
    if (now != null && now - e.at > maxAge) continue;
    out[k] = { at: e.at, images: toPreviewImages(e.images as ImageLike[]) };
  }
  return out;
}

/** The cache with one version's list set (newer wins), trimmed to the newest `max` versions. */
export function mergePopular(cache: PopularCache, versionId: number, images: PreviewImage[], at: number, max = POPULAR_MAX_VERSIONS): PopularCache {
  const next: PopularCache = { ...cache, [popularKey(versionId)]: { at, images } };
  const keys = Object.keys(next);
  if (keys.length <= max) return next;
  keys.sort((a, b) => next[b].at - next[a].at);
  const kept: PopularCache = {};
  for (const k of keys.slice(0, Math.max(0, max))) kept[k] = next[k];
  return kept;
}

/**
 * The preview's play-list for one model: CivitAI's curated pictures, the popular list (only
 * used for 'popular'; pictures `allow` refuses — beyond the NSFW mask — are left out of it), and
 * local generation urls (only used for 'history'). Duplicates by `imageKey`; for a picture in both
 * lists the curated object is kept. 'random' reshuffles on every call.
 */
export function orderPreviewImages(
  curated: readonly PreviewImage[],
  opts: {
    source: ModelPreviewSource;
    popular?: readonly PreviewImage[] | null;
    history?: readonly string[];
    allow?: (img: PreviewImage) => boolean;
  },
): PreviewImage[] {
  const byKey = new Map<string, PreviewImage>();
  const keysOf = (list: readonly PreviewImage[]) => list.filter((img) => !!img?.url).map((img) => {
    const k = img.local ? img.url : imageKey(img.url);
    if (!byKey.has(k)) byKey.set(k, img);
    return k;
  });
  const c = keysOf(curated);
  const p = opts.source === 'popular' ? keysOf((opts.popular ?? []).filter((img) => !opts.allow || opts.allow(img))) : [];
  const h = opts.source === 'history' ? keysOf((opts.history ?? []).map((url) => ({ url, local: true }))) : [];
  return orderForPreview(c, h, opts.source, p).map((k) => byKey.get(k)!);
}

/** The lower-cased file name without its folder: how a history entry and a model file meet. */
export function fileKey(name: string): string {
  return (name.split(/[\\/]/).pop() ?? name).toLowerCase();
}

/**
 * Local generations per model file (`fileKey`), newest first, as urls. An entry counts for its
 * checkpoint (`entry.model`), every checkpoint / LoRA / the VAE in its workflow snapshot — the
 * classic model modal's `entryUsedModel` rule, by file name. `urlOf` returns null for an entry
 * whose server is gone.
 */
export function historyIndex(history: readonly HistoryEntry[], urlOf: (e: HistoryEntry) => string | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of history) {
    if (!e?.filename) continue;
    const names = new Set<string>();
    if (e.model) names.add(fileKey(e.model));
    const wf = e.workflow;
    if (wf?.vae) names.add(fileKey(wf.vae));
    for (const l of wf?.loras ?? []) if (l?.name) names.add(fileKey(l.name));
    for (const c of wf?.checkpoints ?? []) if (c?.name) names.add(fileKey(c.name));
    names.delete('');
    if (!names.size) continue;
    const url = urlOf(e);
    if (!url) continue;
    for (const n of names) {
      const list = out.get(n);
      if (list) list.push(url); else out.set(n, [url]);
    }
  }
  return out;
}

// ── the cache ──────────────────────────────────────────────────────────────

let mem: PopularCache | null = null;
const inflight = new Map<number, Promise<void>>();
const failed = new Set<number>();
const listeners = new Set<() => void>();
let requests = 0;

function storage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function cache(): PopularCache {
  if (!mem) {
    let raw: string | null = null;
    try { raw = storage()?.getItem(POPULAR_STORE_KEY) ?? null; } catch { /* blocked */ }
    mem = parsePopularCache(raw, Date.now());
  }
  return mem;
}

function store(versionId: number, images: PreviewImage[]) {
  mem = mergePopular(cache(), versionId, images, Date.now());
  try { storage()?.setItem(POPULAR_STORE_KEY, JSON.stringify(mem)); } catch { /* full or blocked: memory only */ }
  for (const fn of listeners) fn();
}

/** The version's popular pictures once loaded (a stable array per load), else undefined. */
export function popularFor(versionId: number | null | undefined): PreviewImage[] | undefined {
  if (versionId == null) return undefined;
  return cache()[popularKey(versionId)]?.images;
}

/** Called after any version's list lands. */
export function subscribePopular(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** At most this many popular lookups run at once; the rest wait in order (tiles scrolling into view). */
const MAX_RUNNING = 3;
const queued: number[] = [];

function pump(): void {
  while (inflight.size < MAX_RUNNING && queued.length) {
    const versionId = queued.shift()!;
    if (popularFor(versionId) || inflight.has(versionId) || failed.has(versionId)) continue;
    requests++;
    const job = fetchCivitaiImages(versionId, null, 'all', { sort: 'Most Reactions', limit: POPULAR_LIMIT, everyLevel: true })
      .then((page) => {
        if (page) store(versionId, toPreviewImages(page.items));
        else failed.add(versionId);
      })
      .catch(() => { failed.add(versionId); })
      .finally(() => { inflight.delete(versionId); pump(); });
    inflight.set(versionId, job);
  }
}

/**
 * Load the version's popular list if it is not cached, loading or failed already — at most one
 * CivitAI request per version per page load (none when localStorage has it), three at a time.
 */
export function requestPopular(versionId: number | null | undefined): void {
  if (versionId == null || !Number.isFinite(versionId)) return;
  if (popularFor(versionId) || inflight.has(versionId) || failed.has(versionId) || queued.includes(versionId)) return;
  queued.push(versionId);
  pump();
}

/** A tile scrolled away before its turn: drop it from the queue (a running request finishes). */
export function cancelPopular(versionId: number | null | undefined): void {
  const i = versionId == null ? -1 : queued.indexOf(versionId);
  if (i >= 0) queued.splice(i, 1);
}

/**
 * Hand in a Most-Reactions first page fetched elsewhere at every level (the Models screen's
 * gallery / the model viewer), so a model already opened big costs no extra request.
 */
export function seedPopular(versionId: number | null | undefined, items: readonly ImageLike[]): void {
  if (versionId == null || popularFor(versionId)) return;
  const images = toPreviewImages(items).slice(0, POPULAR_LIMIT);
  if (images.length) store(versionId, images);
}

/** How many requests this page load has made (tests / debugging). */
export function popularRequestCount(): number { return requests; }
