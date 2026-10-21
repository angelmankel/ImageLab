/**
 * Items 12 + 13: the tile grid's UI state. The grid mode (Manual / Auto) is remembered; which
 * tile is being edited (opened from its right-click menu) and the prompt box's Prompt / Negative
 * mode are not (a reload always opens on the positive prompt).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GridMode = 'manual' | 'auto';

interface TileUi {
  gridMode: GridMode;
  setGridMode: (m: GridMode) => void;
  /** Item 47: the grid shows only the tiles that are on. */
  onOnly: boolean;
  setOnOnly: (v: boolean) => void;
}

export const useTileUi = create<TileUi>()(
  persist((set) => ({
    gridMode: 'manual', setGridMode: (gridMode) => set({ gridMode }),
    onOnly: false, setOnOnly: (onOnly) => set({ onOnly }),
  }), { name: 'imagelab.next.tiles.v1', partialize: (s) => ({ gridMode: s.gridMode }) }),
);

interface TileEdit {
  /** Item 42: a snippet id being edited, 'new' / 'new-neg' for the quick add modal, or null. */
  editing: string | null;
  /** Text to start a new snippet with ("☆ Save as a tile" on a prompt part). */
  draftText: string;
  /** The category a new snippet starts in ('' = the kind's default). */
  draftCat: string;
  edit: (id: string | null, draftText?: string, draftCat?: string) => void;
  /** Item 42: the Manage window — null closed, '' open on the first category, else that category id. */
  manage: string | null;
  openManage: (categoryId?: string | null) => void;
  /** The prompt box's mode. */
  negative: boolean;
  setNegative: (v: boolean) => void;
}

export const useTileEdit = create<TileEdit>((set) => ({
  editing: null,
  draftText: '',
  draftCat: '',
  edit: (editing, draftText = '', draftCat = '') => set({ editing, draftText, draftCat }),
  manage: null,
  openManage: (categoryId = '') => set({ manage: categoryId }),
  negative: false,
  setNegative: (negative) => set({ negative }),
}));
