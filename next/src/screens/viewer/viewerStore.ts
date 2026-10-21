/**
 * Item 30 / list-2 item 22: the viewer's own preferences (persisted): the metadata view on or off
 * (off = the real full screen a canvas click opens; ⓘ turns the strip + panel on and it stays), its tab, the
 * slideshow transition and speed. Whether the slideshow plays is the main store's
 * `slideshowPlaying` (the controller and the old viewer share it).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isShowTransition, type ShowTransition } from './slideshowLogic';

export type ViewerTab = 'send' | 'details';

interface ViewerPrefs {
  /** The metadata view (thumbnail strip + side panel / phone sheet). */
  meta: boolean;
  tab: ViewerTab;
  transition: ShowTransition;
  speedMs: number;
  setMeta: (on: boolean) => void;
  setTab: (t: ViewerTab) => void;
  setTransition: (t: ShowTransition) => void;
  setSpeed: (ms: number) => void;
}

export const useViewerStore = create<ViewerPrefs>()(
  persist(
    (set) => ({
      meta: false,
      tab: 'details',
      transition: 'dissolve',
      speedMs: 4000,
      setMeta: (meta) => set({ meta }),
      setTab: (tab) => set({ tab }),
      setTransition: (transition) => set({ transition }),
      setSpeed: (speedMs) => set({ speedMs: Math.max(1000, Math.min(60000, speedMs)) }),
    }),
    {
      name: 'imagelab.next.viewer.v1',
      merge: (p, cur) => {
        const s = { ...cur, ...(p as Partial<ViewerPrefs>) };
        if (typeof s.meta !== 'boolean') s.meta = false;
        if (!isShowTransition(s.transition)) s.transition = 'dissolve';
        return s;
      },
    },
  ),
);
