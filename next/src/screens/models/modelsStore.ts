/**
 * The Models screen's state (rule 13): filters (persisted), the loaded pages, the opened model,
 * local favourites / followed creators (CivitAI's own lists are used instead when a key is set),
 * and the layout bits (grid/list, detail panel, the phone's Filters sheet).
 *
 * Fetching: one AbortController; a filter change restarts from the top; "load more" follows the
 * cursor. Pages come through `civitaiApi`'s in-memory cache, so going back to a filter set that
 * was open a minute ago costs nothing.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CivitaiModel } from '@/lib/civitai';
import { T } from '~/theme/tokens';
import {
  DEFAULT_FILTERS, sanitizeFilters, clearAllFilters, clearFilter, planSearch,
  type ModelFilters, type FilterKey,
} from './civitaiQuery';
import { runSearchPlan, hasApiKey, CivitaiError } from './civitaiApi';

export type Source = 'civitai' | 'installed';
export type View = 'grid' | 'list';

const PAGE_SIZE = 40;
const EMPTY_IDS: number[] = [];

interface ModelsState {
  filters: ModelFilters;
  source: Source;
  view: View;

  items: CivitaiModel[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  nextCursor: string | null;
  totalItems: number | null;

  /** The opened model (detail panel / phone page) and which version + sample image is shown. */
  selectedId: number | null;
  selectedVersionId: number | null;
  selectedImage: number;

  favourites: number[];
  followed: string[];
  /** Model ids whose NSFW cover was tapped open this session. */
  revealed: number[];

  panelOpen: boolean;
  panelWidth: number;
  moreOpen: boolean;
  sheetOpen: boolean;

  setFilters: (patch: Partial<ModelFilters>) => void;
  clearAll: () => void;
  clearOne: (key: FilterKey) => void;
  setSource: (s: Source) => void;
  setView: (v: View) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  open: (id: number, versionId?: number | null) => void;
  close: () => void;
  selectVersion: (id: number | null) => void;
  selectImage: (i: number) => void;
  toggleFavourite: (id: number) => void;
  toggleFollow: (username: string) => void;
  reveal: (id: number) => void;
  setPanelOpen: (on: boolean) => void;
  setPanelWidth: (w: number) => void;
  setMoreOpen: (on: boolean) => void;
  setSheetOpen: (on: boolean) => void;
}

let ctrl: AbortController | null = null;
let seq = 0;

function messageOf(e: unknown): string {
  if (e instanceof CivitaiError) return e.message;
  return e instanceof Error ? e.message : 'CivitAI search failed';
}

export const useModels = create<ModelsState>()(
  persist(
    (set, get) => ({
      filters: DEFAULT_FILTERS,
      source: 'civitai',
      view: 'grid',
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
      followed: [],
      revealed: [],
      panelOpen: true,
      panelWidth: T.size.modelsPanel,
      moreOpen: false,
      sheetOpen: false,

      setFilters: (patch) => {
        set({ filters: { ...get().filters, ...patch } });
        void get().refresh();
      },
      clearAll: () => { set({ filters: clearAllFilters(get().filters) }); void get().refresh(); },
      clearOne: (key) => { set({ filters: clearFilter(get().filters, key) }); void get().refresh(); },
      setSource: (source) => set({ source }),
      setView: (view) => set({ view }),

      refresh: async () => {
        ctrl?.abort();
        const c = new AbortController();
        ctrl = c;
        const my = ++seq;
        const { filters, favourites, followed } = get();
        const plan = planSearch(filters, { hasKey: hasApiKey(), favouriteIds: favourites, followedUsers: followed });
        set({ loading: true, error: null, items: [], nextCursor: null, totalItems: null });
        try {
          const page = await runSearchPlan(plan, { limit: PAGE_SIZE }, c.signal);
          if (my !== seq || c.signal.aborted) return;
          set({ loading: false, items: page.items, nextCursor: page.nextCursor, totalItems: page.totalItems ?? null });
        } catch (e) {
          if (my !== seq || c.signal.aborted) return;
          set({ loading: false, error: messageOf(e) });
        }
      },

      loadMore: async () => {
        const { nextCursor, loadingMore, loading, filters, favourites, followed } = get();
        if (loadingMore || loading || !nextCursor) return;
        const my = seq;
        const plan = planSearch(filters, { hasKey: hasApiKey(), favouriteIds: favourites, followedUsers: followed });
        set({ loadingMore: true });
        try {
          const page = await runSearchPlan(plan, { limit: PAGE_SIZE, cursor: nextCursor }, ctrl?.signal);
          if (my !== seq) return;
          const seen = new Set(get().items.map((m) => m.id));
          set({ loadingMore: false, items: [...get().items, ...page.items.filter((m) => !seen.has(m.id))], nextCursor: page.nextCursor });
        } catch (e) {
          if (my !== seq) return;
          set({ loadingMore: false, error: messageOf(e) });
        }
      },

      open: (id, versionId = null) => set({ selectedId: id, selectedVersionId: versionId, selectedImage: 0, panelOpen: true }),
      close: () => set({ selectedId: null, selectedVersionId: null, selectedImage: 0 }),
      selectVersion: (id) => set({ selectedVersionId: id, selectedImage: 0 }),
      selectImage: (i) => set({ selectedImage: i }),
      toggleFavourite: (id) => set((s) => ({ favourites: s.favourites.includes(id) ? s.favourites.filter((x) => x !== id) : [...s.favourites, id] })),
      toggleFollow: (u) => set((s) => ({ followed: s.followed.includes(u) ? s.followed.filter((x) => x !== u) : [...s.followed, u] })),
      reveal: (id) => set((s) => (s.revealed.includes(id) ? s : { revealed: [...s.revealed, id] })),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setMoreOpen: (moreOpen) => set({ moreOpen }),
      setSheetOpen: (sheetOpen) => set({ sheetOpen }),
    }),
    {
      name: 'imagelab.next.models.v1',
      partialize: (s) => ({ filters: s.filters, source: s.source, view: s.view, favourites: s.favourites, followed: s.followed, panelOpen: s.panelOpen, panelWidth: s.panelWidth }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<ModelsState>;
        return { ...current, ...p, filters: sanitizeFilters(p.filters) };
      },
    },
  ),
);

/** The opened model as loaded in the list (the detail hook fetches the full one). */
export const useSelectedListItem = () => useModels((s) => (s.selectedId == null ? undefined : s.items.find((m) => m.id === s.selectedId)));
