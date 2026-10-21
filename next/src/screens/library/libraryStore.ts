/**
 * Library (rule 12) — the screen's own state, shared by the desktop and phone layouts: the
 * filters (search, collection, kind), sort, tile size, the selected item, multi-select, the
 * detail panel, and the two things the main store has no place for: starred and removed VIDEOS
 * (video results come from the server's history, so they have no `liked` flag and no delete).
 * Prefs persist; the search, the selection and select mode do not.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { T } from '~/theme/tokens';
import { toggleKey, type Bucket, type Kind, type SortKey, type TileSize } from './libraryLogic';

interface LibraryState {
  search: string;
  bucket: Bucket;
  kind: Kind;
  sort: SortKey;
  tileSize: TileSize;
  /** The item shown in the detail panel (desktop) / sheet (phone). */
  selectedKey: string | null;
  /** Multi-select mode and its picks. */
  selecting: boolean;
  picked: readonly string[];
  panelOpen: boolean;
  panelWidth: number;
  /** The desktop page's left column (filter bar + grid, list-2 item 18). */
  gridOpen: boolean;
  gridWidth: number;
  /** Starred video urls. */
  likedVideos: readonly string[];
  /** Video urls removed from the library (the file stays on the server). */
  hiddenVideos: readonly string[];

  setSearch: (s: string) => void;
  setBucket: (b: Bucket) => void;
  setKind: (k: Kind) => void;
  setSort: (s: SortKey) => void;
  setTileSize: (t: TileSize) => void;
  select: (key: string | null) => void;
  setSelecting: (on: boolean) => void;
  togglePick: (key: string) => void;
  setPicked: (keys: readonly string[]) => void;
  setPanelOpen: (on: boolean) => void;
  setPanelWidth: (w: number) => void;
  setGridOpen: (on: boolean) => void;
  setGridWidth: (w: number) => void;
  toggleVideoLiked: (url: string) => void;
  hideVideos: (urls: readonly string[]) => void;
}

const NONE: readonly string[] = Object.freeze([]);
/** The left grid column's default width (3 medium tiles). */
export const GRID_W = 420;

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      search: '',
      bucket: 'all',
      kind: 'all',
      sort: 'newest',
      tileSize: 'm',
      selectedKey: null,
      selecting: false,
      picked: NONE,
      panelOpen: true,
      panelWidth: T.size.libraryPanel,
      gridOpen: true,
      gridWidth: GRID_W,
      likedVideos: NONE,
      hiddenVideos: NONE,

      setSearch: (search) => set({ search }),
      setBucket: (bucket) => set({ bucket }),
      setKind: (kind) => set({ kind }),
      setSort: (sort) => set({ sort }),
      setTileSize: (tileSize) => set({ tileSize }),
      select: (selectedKey) => set({ selectedKey }),
      setSelecting: (selecting) => set({ selecting, picked: NONE }),
      togglePick: (key) => set((s) => ({ picked: toggleKey(s.picked, key) })),
      setPicked: (picked) => set({ picked: picked.length ? picked : NONE }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setGridOpen: (gridOpen) => set({ gridOpen }),
      setGridWidth: (gridWidth) => set({ gridWidth }),
      toggleVideoLiked: (url) => set((s) => ({ likedVideos: toggleKey(s.likedVideos, url) })),
      hideVideos: (urls) => set((s) => ({ hiddenVideos: [...s.hiddenVideos, ...urls.filter((u) => !s.hiddenVideos.includes(u))] })),
    }),
    {
      name: 'imagelab.next.library.v1',
      partialize: (s) => ({
        bucket: s.bucket, kind: s.kind, sort: s.sort, tileSize: s.tileSize, panelOpen: s.panelOpen, panelWidth: s.panelWidth, gridOpen: s.gridOpen, gridWidth: s.gridWidth,
        likedVideos: s.likedVideos, hiddenVideos: s.hiddenVideos,
      }),
    },
  ),
);
