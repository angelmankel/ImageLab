/**
 * What the stage shows beyond the main store's selection: a video or workflow result picked in the
 * history panel (images use `useStore().selectedEntry`, so the fullscreen viewer's pager and the
 * old history logic keep working), and the Compare split view (item 23). Not persisted.
 */
import { create } from 'zustand';

interface StageState {
  /** The key (url) of a video / workflow result on the stage, or null = the image selection. */
  runKey: string | null;
  showRun: (key: string | null) => void;
  /** Compare is on: the stage splits the shown picture against `compareKey`. */
  compare: boolean;
  /** The other side's result key; null = the default (its source for a derived picture, else the previous result). */
  compareKey: string | null;
  setCompare: (on: boolean, key?: string | null) => void;
  setCompareKey: (key: string | null) => void;
}

export const useStage = create<StageState>((set) => ({
  runKey: null,
  showRun: (runKey) => set({ runKey }),
  compare: false,
  compareKey: null,
  setCompare: (compare, key = null) => set({ compare, compareKey: key }),
  setCompareKey: (compareKey) => set({ compareKey }),
}));
