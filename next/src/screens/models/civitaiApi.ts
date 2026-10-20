/**
 * CivitAI network layer for the Models screen (rule 13). Thin: the URLs come from
 * `civitaiQuery.ts`, the API key and the IndexedDB caches come from the main app
 * (`@/lib/storage`, `@/lib/civitai`). What is new here is only what the main app does not have:
 * a full-parameter /models search, /model-versions/:id, /images with every parameter, /tags and
 * /creators, and a small in-memory page cache so paging back and forth does not re-hit the API
 * (the pod rate-limits).
 */
import { loadCivitaiSettings } from '@/lib/storage';
import {
  fetchCivitaiModel, fetchCivitaiByHash,
  type CivitaiModel, type CivitaiModelVersion, type CivitaiImage, type CivitaiCacheEntry, type CivitaiVersionByHash,
} from '@/lib/civitai';
import {
  apiBase, buildModelsQuery, buildImagesQuery, buildListQuery, CIVITAI_API,
  type ModelFilters, type ImagesQuery, type QueryOptions, type SearchPlan,
} from './civitaiQuery';

export type { CivitaiModel, CivitaiModelVersion, CivitaiImage };

export class CivitaiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'CivitaiError'; }
}

const TIMEOUT_MS = 15_000;
const BACKOFF_MS = 2500;
const PAGE_TTL_MS = 5 * 60_000;
const PAGE_CACHE_MAX = 80;

export function hasApiKey(): boolean { return !!loadCivitaiSettings().apiKey.trim(); }

/** The token as a query param, as the main app does (a header would force a CORS preflight). */
function withToken(url: string): string {
  const key = loadCivitaiSettings().apiKey.trim();
  if (!key) return url;
  return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(key);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function getOnce(url: string, signal?: AbortSignal): Promise<{ status: number; ok: boolean; body: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const onAbort = () => ac.abort();
  if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  try {
    const res = await fetch(withToken(url), { signal: ac.signal });
    const body = await res.text();
    return { status: res.status, ok: res.ok, body };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** GET + JSON with a timeout and one back-off retry on 429. Throws `CivitaiError`. */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Awaited<ReturnType<typeof getOnce>>;
  try {
    res = await getOnce(url, signal);
    if (res.status === 429) {
      await sleep(BACKOFF_MS);
      if (signal?.aborted) throw new CivitaiError('cancelled', 0);
      res = await getOnce(url, signal);
    }
  } catch (e) {
    if (e instanceof CivitaiError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new CivitaiError(signal?.aborted ? 'cancelled' : 'CivitAI did not answer in time', 0);
    throw new CivitaiError(`CivitAI unreachable: ${(e as Error)?.message ?? e}`, 0);
  }
  if (res.status === 429) throw new CivitaiError('CivitAI rate limit — wait a minute', 429);
  if (res.status === 401 || res.status === 403) throw new CivitaiError('CivitAI refused the API key (Settings → CivitAI)', res.status);
  if (!res.ok) throw new CivitaiError(`CivitAI answered HTTP ${res.status}`, res.status);
  try { return JSON.parse(res.body) as T; } catch { throw new CivitaiError('CivitAI sent something that is not JSON', res.status); }
}

// ── in-memory page cache ───────────────────────────────────────────────────

const pages = new Map<string, { at: number; value: unknown }>();

async function cached<T>(url: string, signal: AbortSignal | undefined, load: () => Promise<T>): Promise<T> {
  const hit = pages.get(url);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return hit.value as T;
  const value = await load();
  pages.set(url, { at: Date.now(), value });
  if (pages.size > PAGE_CACHE_MAX) {
    const oldest = [...pages.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) pages.delete(oldest);
  }
  void signal;
  return value;
}

export function clearPageCache(): void { pages.clear(); }

// ── /models ────────────────────────────────────────────────────────────────

export interface ModelPage {
  items: CivitaiModel[];
  nextCursor: string | null;
  totalItems?: number;
}

type RawPage = { items?: CivitaiModel[]; metadata?: { nextCursor?: string | number | null; totalItems?: number; nextPage?: string } };

function pageOf(json: RawPage): ModelPage {
  const nc = json.metadata?.nextCursor;
  return { items: json.items ?? [], nextCursor: nc != null ? String(nc) : null, totalItems: json.metadata?.totalItems };
}

/** One page of GET /api/v1/models for a filter set. */
export async function searchModels(f: ModelFilters, o: QueryOptions = {}, signal?: AbortSignal): Promise<ModelPage> {
  const url = `${apiBase(f.catalog)}/models?${buildModelsQuery(f, o)}`;
  return cached(url, signal, async () => pageOf(await getJson<RawPage>(url, signal)));
}

/** Run a search plan: one request, or (followed creators without a key) one per creator, merged. */
export async function runSearchPlan(plan: SearchPlan, o: QueryOptions = {}, signal?: AbortSignal): Promise<ModelPage> {
  if (plan.empty) return { items: [], nextCursor: null, totalItems: 0 };
  if (!plan.usernames?.length) return searchModels(plan.filters, o, signal);
  if (o.cursor) return { items: [], nextCursor: null }; // merged creator feeds are one page each
  const pagesOut = await Promise.all(plan.usernames.map((username) =>
    searchModels({ ...plan.filters, username }, { ...o, limit: Math.min(o.limit ?? 40, 25) }, signal).catch(() => ({ items: [], nextCursor: null } as ModelPage))));
  const seen = new Set<number>();
  const items: CivitaiModel[] = [];
  for (const p of pagesOut) for (const m of p.items) if (!seen.has(m.id)) { seen.add(m.id); items.push(m); }
  return { items, nextCursor: null, totalItems: items.length };
}

/** GET /api/v1/models/:id — the full model (every version, files, hashes, gallery). IDB-cached by the main app. */
export function fetchModel(modelId: number, signal?: AbortSignal): Promise<CivitaiModel> {
  return fetchCivitaiModel(modelId, signal);
}

/** GET /api/v1/models?ids=… */
export async function fetchModelsByIds(ids: number[], f: ModelFilters, signal?: AbortSignal): Promise<ModelPage> {
  if (!ids.length) return { items: [], nextCursor: null, totalItems: 0 };
  return searchModels({ ...f, ids, favorites: false, followed: false }, { limit: Math.min(100, ids.length) }, signal);
}

// ── /model-versions ────────────────────────────────────────────────────────

export type VersionWithModel = CivitaiModelVersion & { modelId: number; model: { name: string; type: string; nsfw?: boolean; poi?: boolean } };

/** GET /api/v1/model-versions/:id */
export async function fetchModelVersion(versionId: number, signal?: AbortSignal): Promise<VersionWithModel> {
  const url = `${CIVITAI_API}/model-versions/${versionId}`;
  return cached(url, signal, () => getJson<VersionWithModel>(url, signal));
}

/** GET /api/v1/model-versions/by-hash/:hash — through the main app's IDB cache. */
export async function fetchVersionByHash(hash: string, signal?: AbortSignal): Promise<CivitaiVersionByHash | null> {
  const entry: CivitaiCacheEntry = await fetchCivitaiByHash(hash, signal);
  return entry.status === 'found' ? (entry.data as CivitaiVersionByHash) : null;
}

// ── /images ────────────────────────────────────────────────────────────────

export interface ImagePage { items: CivitaiImage[]; nextCursor: string | null }

/** GET /api/v1/images — sample images with their generation `meta`. */
export async function fetchImages(q: ImagesQuery, signal?: AbortSignal): Promise<ImagePage> {
  const url = `${CIVITAI_API}/images?${buildImagesQuery(q)}`;
  return cached(url, signal, async () => {
    const json = await getJson<{ items?: CivitaiImage[]; metadata?: { nextCursor?: string | number | null } }>(url, signal);
    const nc = json.metadata?.nextCursor;
    return { items: json.items ?? [], nextCursor: nc != null ? String(nc) : null };
  });
}

// ── /tags, /creators ───────────────────────────────────────────────────────

export interface TagRow { name: string; modelCount: number; link: string }
export interface CreatorRow { username: string; modelCount: number; link: string; image?: string | null }
export interface ListPage<T> { items: T[]; totalItems: number; nextPage: string | null }

type RawList<T> = { items?: T[]; metadata?: { totalItems?: number; nextPage?: string | null } };
function listOf<T>(json: RawList<T>): ListPage<T> {
  return { items: json.items ?? [], totalItems: json.metadata?.totalItems ?? (json.items?.length ?? 0), nextPage: json.metadata?.nextPage ?? null };
}

/** GET /api/v1/tags?query= */
export async function fetchTags(q: { query?: string; limit?: number; page?: number }, signal?: AbortSignal): Promise<ListPage<TagRow>> {
  const url = `${CIVITAI_API}/tags?${buildListQuery(q)}`;
  return cached(url, signal, async () => listOf(await getJson<RawList<TagRow>>(url, signal)));
}

/** GET /api/v1/creators?query= */
export async function fetchCreators(q: { query?: string; limit?: number; page?: number }, signal?: AbortSignal): Promise<ListPage<CreatorRow>> {
  const url = `${CIVITAI_API}/creators?${buildListQuery(q)}`;
  return cached(url, signal, async () => listOf(await getJson<RawList<CreatorRow>>(url, signal)));
}

/** The model's page on the site. */
export function civitaiModelLink(modelId: number, versionId?: number): string {
  return `https://civitai.com/models/${modelId}${versionId ? `?modelVersionId=${versionId}` : ''}`;
}
