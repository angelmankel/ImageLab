/**
 * Desktop side-panel widths, dragged by <PanelResizeHandle> and kept across reloads — the v1
 * layout's resizable panels. Mobile drawers ignore all of this and keep their own sizing.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEFT_W, RIGHT_W } from './constants';

export type PanelSide = 'left' | 'right';

export const PANEL_LIMITS: Record<PanelSide, { min: number; max: number; default: number }> = {
  left: { min: 300, max: 640, default: LEFT_W },
  right: { min: 260, max: 560, default: RIGHT_W },
};

/** Drag this far past the minimum and the panel folds away, as a v1 collapsible panel did. */
export const COLLAPSE_SLACK = 80;

/** Never let the two panels leave the canvas less than this share of the window. */
const MIN_CANVAS_SHARE = 0.3;

interface PanelLayoutState {
  left: number;
  right: number;
  /** True while a handle is held. Inset transitions switch off so the canvas tracks the pointer. */
  dragging: boolean;
  setWidth: (side: PanelSide, width: number) => void;
  reset: (side: PanelSide) => void;
  setDragging: (dragging: boolean) => void;
}

export function clampWidth(side: PanelSide, width: number, other: number): number {
  const { min, max } = PANEL_LIMITS[side];
  const room = typeof window === 'undefined' ? max : window.innerWidth * (1 - MIN_CANVAS_SHARE) - other;
  return Math.round(Math.max(min, Math.min(max, room, width)));
}

export const usePanelLayout = create<PanelLayoutState>()(
  persist(
    (set) => ({
      left: LEFT_W,
      right: RIGHT_W,
      dragging: false,
      setWidth: (side, width) => set(s => ({ [side]: clampWidth(side, width, side === 'left' ? s.right : s.left) })),
      reset: (side) => set({ [side]: PANEL_LIMITS[side].default }),
      setDragging: (dragging) => set({ dragging }),
    }),
    {
      name: 'imagelab.panelLayout.v1',
      partialize: (s) => ({ left: s.left, right: s.right }),
    },
  ),
);
