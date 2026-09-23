/** Viewer preferences kept in this browser. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ViewerPrefs {
  /** Show a running job's live preview frames in the fullscreen viewer. On by default. */
  livePreview: boolean;
  setLivePreview: (on: boolean) => void;
}

export const useViewerPrefs = create<ViewerPrefs>()(
  persist(
    (set) => ({
      livePreview: true,
      setLivePreview: (livePreview) => set({ livePreview }),
    }),
    { name: 'imagelab.viewerPrefs.v1' },
  ),
);
