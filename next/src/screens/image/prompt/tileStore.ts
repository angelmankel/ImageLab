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
}

export const useTileUi = create<TileUi>()(
  persist((set) => ({ gridMode: 'manual', setGridMode: (gridMode) => set({ gridMode }) }), { name: 'imagelab.next.tiles.v1' }),
);

interface TileEdit {
  /** A snippet id being edited, 'new' for the add form, or null. */
  editing: string | null;
  /** Text to start a new tile with ("☆ Save as a tile" on a prompt part). */
  draftText: string;
  edit: (id: string | null, draftText?: string) => void;
  /** The prompt box's mode. */
  negative: boolean;
  setNegative: (v: boolean) => void;
}

export const useTileEdit = create<TileEdit>((set) => ({
  editing: null,
  draftText: '',
  edit: (editing, draftText = '') => set({ editing, draftText }),
  negative: false,
  setNegative: (negative) => set({ negative }),
}));
