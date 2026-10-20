/**
 * What the stage shows beyond the main store's selection: a video or workflow result picked in the
 * history panel (images use `useStore().selectedEntry`, so the fullscreen viewer's pager and the
 * old history logic keep working). Not persisted.
 */
import { create } from 'zustand';

interface StageState {
  /** The key (url) of a video / workflow result on the stage, or null = the image selection. */
  runKey: string | null;
  showRun: (key: string | null) => void;
}

export const useStage = create<StageState>((set) => ({
  runKey: null,
  showRun: (runKey) => set({ runKey }),
}));
