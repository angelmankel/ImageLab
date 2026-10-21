/**
 * The Models picker's state (rule 13 + the models-picker brief): filters (persisted), the loaded
 * pages, the opened model, the picked tags, the picker's kind lock, local favourites / followed
 * creators, the "has downloaded once" flag behind the Downloaded default, and the layout bits.
 *
 * Favourites live HERE, in the browser's persisted store (localStorage via zustand/persist +
 * `navigator.storage.persist()`), because the pod is ephemeral and its favourites API is for
 * images — see CONVENTIONS.md → Favourites.
 *
 * Fetching: one AbortController; a filter change restarts from the top; "load more" follows the
 * cursor. Pages come through `civitaiApi`'s in-memory cache. A search already loaded this session
 * comes back with every page it had (`loadedLists`), so a reopened picker or a trip through another
 * kind finds the same rows under its kept scroll position (`useKeepScroll`).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CivitaiModel } from '@/lib/civitai';
import {
  DEFAULT_FILTERS, sanitizeFilters, clearAllFilters, clearFilter, planSearch, effectiveFilters,
  type ModelFilters, type FilterKey, type ModelKindKey,
} from './civitaiQuery';
import { runSearchPlan, hasApiKey, CivitaiError } from './civitaiApi';

/** Downloaded = what is on the pod (the servers' CivitAI-known files); CivitAI = the catalog. */

/** The detail panel's default width (item 32: wider than the 380 it was). */
export const PANEL_W = 500;
export type Source = 'civitai' | 'installed';
export type View = 'grid' | 'list';

const PAGE_SIZE = 40;
const EMPTY_IDS: number[] = [];
const EMPTY_STR: string[] = [];

interface ModelsState {
  filters: ModelFilters;
  source: Source;
  view: View;
  /** The picker's kind (a step's "Change ▾"); null = the free browser. Not persisted. */
  kind: ModelKindKey | null;
  /** Picked tags (tag browsing); the first is the API's `tag`, the rest rank client-side. */
  selectedTags: string[];
  /** Once true, the list no longer defaults to Downloaded. */
  hasDownloadedOnce: boolean;

  items: CivitaiModel[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  nextCursor: string | null;
  totalItems: number | null;

  selectedId: number | null;
  selectedVersionId: number | null;
  selectedImage: number;

  favourites: number[];
  followed: string[];
  revealed: number[];
  /** "Always show NSFW images" (fix list 2 item 27): off = NSFW pictures are covered until tapped. */
  showNsfw: boolean;
  /** The user confirmed the opt-in once: turning it back on later asks no more. */
  nsfwConfirmed: boolean;

  panelOpen: boolean;
  panelWidth: number;
  moreOpen: boolean;
  tagsOpen: string | null;
  sheetOpen: boolean;

  setFilters: (patch: Partial<ModelFilters>) => void;
  clearAll: () => void;
  clearOne: (key: FilterKey) => void;
  setSource: (s: Source) => void;
  setView: (v: View) => void;
  setKind: (k: ModelKindKey | null) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  markDownloaded: () => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  open: (id: number, versionId?: number | null) => void;
  close: () => void;
  selectVersion: (id: number | null) => void;
  /** Turns the NSFW opt-in on / off; `confirmed` records that the first-time confirm was answered. */
  setShowNsfw: (on: boolean) => void;
  selectImage: (i: number) => void;
  toggleFavourite: (id: number) => void;
  toggleFollow: (username: string) => void;
  reveal: (id: number) => void;
  setPanelOpen: (on: boolean) => void;
  setPanelWidth: (w: number) => void;
  setMoreOpen: (on: boolean) => void;
  setTagsOpen: (group: string | null) => void;
  setSheetOpen: (on: boolean) => void;
}

let ctrl: AbortController | null = null;
let seq = 0;

/** Every search loaded this session (by its plan), with all its pages — memory only, newest last. */
interface LoadedList { items: CivitaiModel[]; nextCursor: string | null; totalItems: number | null }
const loadedLists = new Map<string, LoadedList>();
const MAX_LISTS = 12;
function keepList(key: string, list: LoadedList) {
  loadedLists.delete(key);
  loadedLists.set(key, list);
  if (loadedLists.size > MAX_LISTS) loadedLists.delete(loadedLists.keys().next().value as string);
}

function messageOf(e: unknown): string {
  if (e instanceof CivitaiError) return e.message;
  return e instanceof Error ? e.message : 'CivitAI search failed';
}

/** The filters a search really uses (kind lock + picked tags). */
export function searchFilters(s: Pick<ModelsState, 'filters' | 'kind' | 'selectedTags'>): ModelFilters {
  return effectiveFilters(s.filters, s.kind, s.selectedTags);
}

/** Ask the browser to keep this origin's storage: favourites are the one thing a pod wipe cannot restore. */
let persistAsked = false;
function askPersist() {
  if (persistAsked || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistAsked = true;
  void navigator.storage.persist().catch(() => undefined);
}

export const useModels = create<ModelsState>()(
  persist(
    (set, get) => ({
      filters: DEFAULT_FILTERS,
      source: 'installed',
      view: 'grid',
      kind: null,
      selectedTags: EMPTY_STR,
      hasDownloadedOnce: false,
      items: [],
      loading: false,
      loadingMore: false,
      error: null,
      nextCursor: null,
      totalItems: null,
      selectedId: null,
      selectedVersionId: null,
      selectedImage: 0,
      favourites: EMPTY_IDS,
      followed: EMPTY_STR,
      revealed: [],
      showNsfw: false,
      nsfwConfirmed: false,
      panelOpen: true,
      panelWidth: PANEL_W,
      moreOpen: false,
      tagsOpen: null,
      sheetOpen: false,

      setFilters: (patch) => {
        set({ filters: { ...get().filters, ...patch } });
        void get().refresh();
      },
      clearAll: () => { set({ filters: clearAllFilters(get().filters), selectedTags: EMPTY_STR }); void get().refresh(); },
      clearOne: (key) => { set({ filters: clearFilter(get().filters, key) }); void get().refresh(); },
      setSource: (source) => {
        set({ source });
        // Leaving Downloaded for the catalog with nothing loaded yet: fetch the first page.
        const s = get();
        if (source === 'civitai' && s.items.length === 0 && !s.loading) void s.refresh();
      },
      setView: (view) => set({ view }),
      setKind: (kind) => {
        if (kind === get().kind) return;
        set({ kind, selectedId: null, selectedVersionId: null });
        void get().refresh();
      },
      toggleTag: (tag) => {
        const t = tag.trim().toLowerCase();
        if (!t) return;
        const cur = get().selectedTags;
        const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
        // Only the API's one tag (the first) changes the request; the rest rank what is loaded.
        const refetch = next[0] !== cur[0];
        set({ selectedTags: next });
        if (refetch) void get().refresh();
      },
      clearTags: () => { const had = get().selectedTags.length > 0; set({ selectedTags: EMPTY_STR }); if (had) void get().refresh(); },
      markDownloaded: () => {
        if (get().hasDownloadedOnce) return;
        // Only remembered: the source stays what Donny picked (10-20: no switching it for him).
        set({ hasDownloadedOnce: true });
      },

      refresh: async () => {
        ctrl?.abort();
        const c = new AbortController();
        ctrl = c;
        const my = ++seq;
        const s = get();
        const plan = planSearch(searchFilters(s), { hasKey: hasApiKey(), favouriteIds: s.favourites, followedUsers: s.followed });
        const key = JSON.stringify(plan);
        const had = loadedLists.get(key);
        // Loaded before this session: the same pages back at once, no refetch, no reset.
        if (had) { set({ loading: false, loadingMore: false, error: null, ...had }); return; }
        set({ loading: true, error: null, items: [], nextCursor: null, totalItems: null });
        try {
          const page = await runSearchPlan(plan, { limit: PAGE_SIZE }, c.signal);
          if (my !== seq || c.signal.aborted) return;
          const list = { items: page.items, nextCursor: page.nextCursor, totalItems: page.totalItems ?? null };
          keepList(key, list);
          set({ loading: false, ...list });
        } catch (e) {
          if (my !== seq || c.signal.aborted) return;
          set({ loading: false, error: messageOf(e) });
        }
      },

      loadMore: async () => {
        const s = get();
        if (s.loadingMore || s.loading || !s.nextCursor) return;
        const my = seq;
        const plan = planSearch(searchFilters(s), { hasKey: hasApiKey(), favouriteIds: s.favourites, followedUsers: s.followed });
        set({ loadingMore: true });
        try {
          const page = await runSearchPlan(plan, { limit: PAGE_SIZE, cursor: s.nextCursor }, ctrl?.signal);
          if (my !== seq) return;
          const seen = new Set(get().items.map((m) => m.id));
          const items = [...get().items, ...page.items.filter((m) => !seen.has(m.id))];
          keepList(JSON.stringify(plan), { items, nextCursor: page.nextCursor, totalItems: get().totalItems });
          set({ loadingMore: false, items, nextCursor: page.nextCursor });
        } catch (e) {
          if (my !== seq) return;
          set({ loadingMore: false, error: messageOf(e) });
        }
      },

      open: (id, versionId = null) => set({ selectedId: id, selectedVersionId: versionId, selectedImage: 0, panelOpen: true }),
      close: () => set({ selectedId: null, selectedVersionId: null, selectedImage: 0 }),
      selectVersion: (id) => set({ selectedVersionId: id, selectedImage: 0 }),
      selectImage: (i) => set({ selectedImage: i }),
      toggleFavourite: (id) => { askPersist(); set((s) => ({ favourites: s.favourites.includes(id) ? s.favourites.filter((x) => x !== id) : [...s.favourites, id] })); },
      toggleFollow: (u) => { askPersist(); set((s) => ({ followed: s.followed.includes(u) ? s.followed.filter((x) => x !== u) : [...s.followed, u] })); },
      reveal: (id) => set((s) => (s.revealed.includes(id) ? s : { revealed: [...s.revealed, id] })),
      setShowNsfw: (on) => set((s) => ({ showNsfw: on, nsfwConfirmed: s.nsfwConfirmed || on })),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setMoreOpen: (moreOpen) => set({ moreOpen }),
      setTagsOpen: (tagsOpen) => set({ tagsOpen }),
      setSheetOpen: (sheetOpen) => set({ sheetOpen }),
    }),
    {
      name: 'imagelab.next.models.v1',
      partialize: (s) => ({ v: 3, filters: s.filters, source: s.source, view: s.view, favourites: s.favourites, followed: s.followed, panelOpen: s.panelOpen, panelWidth: s.panelWidth, hasDownloadedOnce: s.hasDownloadedOnce, showNsfw: s.showNsfw, nsfwConfirmed: s.nsfwConfirmed }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<ModelsState> & { v?: number };
        const hasDownloadedOnce = !!p.hasDownloadedOnce;
        // v1 saves carry the old Month + Soft defaults; once, they take the new AllTime + X ones.
        const filters = sanitizeFilters(p.filters);
        if ((p.v ?? 1) < 2) { filters.period = DEFAULT_FILTERS.period; filters.nsfwMask = DEFAULT_FILTERS.nsfwMask; }
        // v3 (item 32): the detail panel is wider; an older, narrower save grows once.
        if ((p.v ?? 1) < 3 && typeof p.panelWidth === 'number') p.panelWidth = Math.max(p.panelWidth, PANEL_W);
        return {
          ...current, ...p,
          filters,
          hasDownloadedOnce,
          showNsfw: p.showNsfw === true,
          nsfwConfirmed: p.nsfwConfirmed === true,
          // Downloaded on a new install; after that whatever was picked last.
          source: p.source === 'civitai' || p.source === 'installed' ? p.source : 'installed',
          favourites: Array.isArray(p.favourites) ? p.favourites.filter((n) => Number.isInteger(n)) : EMPTY_IDS,
          followed: Array.isArray(p.followed) ? p.followed.filter((u) => typeof u === 'string') : EMPTY_STR,
        };
      },
    },
  ),
);

/** The opened model as loaded in the list (the detail hook fetches the full one). */
export const useSelectedListItem = () => useModels((s) => (s.selectedId == null ? undefined : s.items.find((m) => m.id === s.selectedId)));
