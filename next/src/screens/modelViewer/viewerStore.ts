/**
 * The viewer's state: what is open (a CivitAI model, or a server file), which version and which
 * sample image are shown. A layer, not a route: opening never touches the hash router, closing
 * leaves whatever was under it (the picker modal) as it was.
 */
import { create } from 'zustand';

export type ModelViewerTarget =
  | { modelId: number; versionId?: number | null; imageIndex?: number }   // a CivitAI model
  | { file: string };                                                     // a server file name (Model tab)

interface ViewerState {
  opened: boolean;
  target: ModelViewerTarget | null;
  /** The shown version; null = the target's, or the model's first. */
  versionId: number | null;
  imageIndex: number;
  open: (target: ModelViewerTarget) => void;
  close: () => void;
  setVersion: (id: number | null) => void;
  setImage: (i: number) => void;
}

export const useModelViewer = create<ViewerState>()((set) => ({
  opened: false,
  target: null,
  versionId: null,
  imageIndex: 0,
  open: (target) => set({
    opened: true, target,
    versionId: 'modelId' in target ? target.versionId ?? null : null,
    imageIndex: 'modelId' in target ? Math.max(0, target.imageIndex ?? 0) : 0,
  }),
  close: () => set({ opened: false }),
  setVersion: (versionId) => set({ versionId, imageIndex: 0 }),
  setImage: (imageIndex) => set({ imageIndex: Math.max(0, imageIndex) }),
}));

export function openModelViewer(target: ModelViewerTarget): void { useModelViewer.getState().open(target); }
export function closeModelViewer(): void { useModelViewer.getState().close(); }
