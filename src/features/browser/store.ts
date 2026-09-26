import { create } from 'zustand';
import {
  searchCivitaiModels,
  CIVITAI_SORTS,
  CIVITAI_MODEL_TYPES,
  type CivitaiSearchParams,
  type CivitaiSearchHit,
  type CivitaiSearchType,
  type CivitaiSearchSort,
  type CivitaiSearchPeriod,
} from '@/lib/civitai';
import { loadBrowserFilters, saveBrowserFilters } from '@/lib/storage';

/**
 * Feature store for the in-app model browser. Owns the filter state
 * (search query / chips / sort / period / NSFW) and the paginated result
 * list. Filters persist via localStorage; results live in memory and are
 * rebuilt on filter change.
 *
 * One AbortController is kept on the module level so a new filter set
 * cancels any in-flight page request instead of letting late results
 * pollute the list.
 */

export type BrowserFilters = {
  query: string;
  types: CivitaiSearchType[];
  baseModels: string[];
  sort: CivitaiSearchSort;
  period: CivitaiSearchPeriod;
  /** When false, the request omits NSFW. CivitAI doesn't support
   *  NSFW-only on /models, so this is a 2-state toggle, not a tri-state. */
  showNsfw: boolean;
  /** Which catalog to query — 'civitai' (civitai.com, SFW-first) or
   *  'red' (civitai.red, full adult catalog). Same API, different host;
   *  some adult-rated models only appear under 'red'. */
  catalog: 'civitai' | 'red';
  /** Bitfield of CivitAI browsing levels to include in results
   *  (1=G, 2=PG, 4=PG13, 8=R, 16=X, 32=XXX). Default = all (63). */
  browsingLevels: number;
  /** Creator username, exact. */
  username: string;
  /** One CivitAI tag. */
  tag: string;
  checkpointType: '' | 'Trained' | 'Merge';
  fileFormats: string[];
  /** Minimum commercial permission; '' = any. */
  commercialUse: string;
  /** 'only' asks the API for Early Access models; 'hide' drops them here (the API has no "exclude"). */
  earlyAccess: 'any' | 'only' | 'hide';
  /** Matched against the servers' model hashes, here. */
  installed: 'any' | 'only' | 'hide';
  supportsGeneration: boolean;
  primaryFileOnly: boolean;
  /** The API key's own favorites / hidden list. */
  favorites: boolean;
  hidden: boolean;
};

/** Bit values for the CivitAI rating ladder. Stable; do not renumber. */
export const BROWSING_LEVEL_BITS = {
  G:    1,
  PG:   2,
  PG13: 4,
  R:    8,
  X:    16,
  XXX:  32,
} as const;
export const ALL_BROWSING_LEVELS = 63;

export const DEFAULT_FILTERS: BrowserFilters = {
  query: '',
  types: ['Checkpoint'],
  baseModels: [],
  sort: 'Highest Rated',
  period: 'AllTime',
  showNsfw: true,
  catalog: 'civitai',
  browsingLevels: ALL_BROWSING_LEVELS,
  username: '',
  tag: '',
  checkpointType: '',
  fileFormats: [],
  commercialUse: '',
  earlyAccess: 'any',
  installed: 'any',
  supportsGeneration: false,
  primaryFileOnly: false,
  favorites: false,
  hidden: false,
};

/** Saved filters from an older build can hold values the API now rejects (a "Most Buzz" sort 400s). */
function sanitize(f: BrowserFilters): BrowserFilters {
  return {
    ...f,
    sort: (CIVITAI_SORTS as readonly string[]).includes(f.sort) ? f.sort : DEFAULT_FILTERS.sort,
    types: f.types.filter((t) => (CIVITAI_MODEL_TYPES as readonly string[]).includes(t)),
  };
}

/** Filters that differ from the defaults — for the "Reset" count. Catalog and NSFW are not filters. */
export function changedFilterCount(f: BrowserFilters): number {
  const d = DEFAULT_FILTERS;
  let n = 0;
  if (f.query) n++;
  if (f.username) n++;
  if (f.tag) n++;
  if (f.types.join() !== d.types.join()) n++;
  if (f.baseModels.length) n++;
  if (f.sort !== d.sort) n++;
  if (f.period !== d.period) n++;
  if (f.browsingLevels !== d.browsingLevels) n++;
  if (f.checkpointType) n++;
  if (f.fileFormats.length) n++;
  if (f.commercialUse) n++;
  if (f.earlyAccess !== 'any') n++;
  if (f.installed !== 'any') n++;
  if (f.supportsGeneration) n++;
  if (f.primaryFileOnly) n++;
  if (f.favorites) n++;
  if (f.hidden) n++;
  return n;
}

function paramsFor(f: BrowserFilters): CivitaiSearchParams {
  return {
    query: f.query || undefined,
    username: f.username || undefined,
    tag: f.tag || undefined,
    types: f.types,
    baseModels: f.baseModels.length ? f.baseModels : undefined,
    checkpointType: f.checkpointType || undefined,
    fileFormats: f.fileFormats.length ? f.fileFormats : undefined,
    allowCommercialUse: f.commercialUse || undefined,
    earlyAccess: f.earlyAccess === 'only' || undefined,
    supportsGeneration: f.supportsGeneration || undefined,
    primaryFileOnly: f.primaryFileOnly || undefined,
    favorites: f.favorites || undefined,
    hidden: f.hidden || undefined,
    sort: f.sort,
    period: f.period,
    // Civitai Red is an adult catalog; force nsfw=true on the request so
    // the per-model preview galleries include NSFW samples (without it,
    // the API strips them and Red tiles render with no hero image).
    nsfw: f.catalog === 'red' ? true : f.showNsfw,
    catalog: f.catalog,
    browsingLevels: f.browsingLevels,
    limit: PAGE_SIZE,
  };
}

type BrowserState = {
  filters: BrowserFilters;
  items: CivitaiSearchHit[];
  /** True for the initial-page load that follows a filter change. */
  loading: boolean;
  /** True while a "load more" page is in flight. */
  loadingMore: boolean;
  /** Null when the next page is unknown / not yet fetched; "" means end-of-list. */
  nextCursor: string | null;
  /** Set when a fetch fails — the UI shows it inline and offers a retry. */
  error: string | null;
  setFilters: (patch: Partial<BrowserFilters>) => void;
  /** Back to the defaults, keeping the catalog and NSFW choice. */
  resetFilters: () => void;
  /** Re-runs the initial page fetch with the current filters. */
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
};

let _ctrl: AbortController | null = null;

/** CivitAI caps the page at 100; 60 is a sweet spot — a single round-trip
 *  fills several screens worth of tiles, so fast-scroll has runway without
 *  blowing the payload size on tiles the user may never see. */
const PAGE_SIZE = 60;

export const useBrowserStore = create<BrowserState>((set, get) => ({
  filters: sanitize({ ...DEFAULT_FILTERS, ...(loadBrowserFilters<Partial<BrowserFilters>>() ?? {}) }),
  items: [],
  loading: false,
  loadingMore: false,
  nextCursor: null,
  error: null,

  setFilters: (patch) => {
    const next = { ...get().filters, ...patch };
    saveBrowserFilters(next);
    set({ filters: next });
    // Filter change always re-fetches from the top.
    void get().refresh();
  },

  resetFilters: () => {
    const { catalog, showNsfw } = get().filters;
    get().setFilters({ ...DEFAULT_FILTERS, catalog, showNsfw });
  },

  refresh: async () => {
    _ctrl?.abort();
    const ctrl = new AbortController();
    _ctrl = ctrl;
    set({ loading: true, error: null, items: [], nextCursor: null });
    const { filters } = get();
    const page = await searchCivitaiModels(paramsFor(filters), ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (!page) {
      set({ loading: false, error: 'CivitAI search failed — try again' });
      return;
    }
    set({ loading: false, items: page.items, nextCursor: page.nextCursor });
  },

  loadMore: async () => {
    const { nextCursor, items, filters, loadingMore } = get();
    if (loadingMore || !nextCursor) return;
    set({ loadingMore: true });
    const page = await searchCivitaiModels({ ...paramsFor(filters), cursor: nextCursor });
    if (!page) {
      set({ loadingMore: false, error: 'Failed to load more results' });
      return;
    }
    set({ loadingMore: false, items: [...items, ...page.items], nextCursor: page.nextCursor });
  },
}));
