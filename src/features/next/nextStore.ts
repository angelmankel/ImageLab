/**
 * The new workspace's own preferences (`features/next`): whether the classic shell is wanted
 * instead, whether the filmstrip floats over the stage, which prompt hub tab was open last. The
 * columns' open state and widths stay in `desktop/desktopLayoutStore` and `layout/panelLayout`,
 * shared with the classic shell so a width dragged in one is the width in the other.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type HubTab = 'write' | 'library' | 'mine';

interface NextState {
  /** Fall back to the old `WorkspaceView` shells (Settings → Workspace → "Classic workspace"). */
  classic: boolean;
  filmstrip: boolean;
  hubTab: HubTab;
  /** The phone's main pane: the step (stage + controls) or the gallery. */
  mobilePane: 'step' | 'gallery';
  setClassic: (on: boolean) => void;
  setFilmstrip: (on: boolean) => void;
  setHubTab: (t: HubTab) => void;
  setMobilePane: (p: 'step' | 'gallery') => void;
}

export const useNext = create<NextState>()(
  persist(
    (set) => ({
      classic: false,
      filmstrip: true,
      hubTab: 'write',
      mobilePane: 'step',
      setClassic: (classic) => set({ classic }),
      setFilmstrip: (filmstrip) => set({ filmstrip }),
      setHubTab: (hubTab) => set({ hubTab }),
      setMobilePane: (mobilePane) => set({ mobilePane }),
    }),
    { name: 'imagelab.next.v1', partialize: (s) => ({ classic: s.classic, filmstrip: s.filmstrip, hubTab: s.hubTab }) },
  ),
);
