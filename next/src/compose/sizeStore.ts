/**
 * The Composition tab's choices (fix list 2, items 2 + 34), persisted: New image / From image,
 * the output shape (a ratio id), the size preset — S / M (the model's default) / L / Custom — for
 * a new image and for an input picture, and Custom's ratio lock. `useCompositionSync` (mounted once
 * in App) keeps the main store's `workflow.width/height` (or `inputMaxSize/inputMinSize`) on the
 * model default while that is chosen — also when the model changes on the Model tab.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '@/lib/store';
import { profileById } from '@/lib/modelProfiles';
import { nativeArea, nativeLongSide, nearestRatio, presetArea, ratioById, sizeForArea, type SizePreset } from './sizeLogic';

export type SizeMode = SizePreset;
export type InputSizeMode = SizePreset;
export type CompositionMode = 'new' | 'from';

interface CompositionState {
  /** New image (empty latent) or From image (img2img); an input picture always means From image. */
  mode: CompositionMode;
  ratio: string;
  sizeMode: SizeMode;
  inputSize: InputSizeMode;
  /** Custom (new image): W and H keep their ratio. */
  lock: boolean;
  setMode: (m: CompositionMode) => void;
  setRatio: (id: string) => void;
  setSizeMode: (m: SizeMode) => void;
  setInputSize: (m: InputSizeMode) => void;
  setLock: (on: boolean) => void;
}

const PRESETS: readonly string[] = ['s', 'model', 'l', 'custom'];

export const useComposition = create<CompositionState>()(
  persist(
    (set) => ({
      mode: 'new',
      ratio: '1:1',
      sizeMode: 'model',
      inputSize: 'model',
      lock: true,
      setMode: (mode) => set({ mode }),
      setRatio: (ratio) => set({ ratio }),
      setSizeMode: (sizeMode) => set({ sizeMode }),
      setInputSize: (inputSize) => set({ inputSize }),
      setLock: (lock) => set({ lock }),
    }),
    {
      name: 'imagelab.next.composition.v1',
      // First run: the shape of the size already set, so nothing jumps.
      merge: (saved, cur) => {
        const s = (saved ?? {}) as Partial<CompositionState>;
        if (!s.ratio) {
          const w = useStore.getState().workflow;
          const r = nearestRatio(w.width, w.height);
          const t = sizeForArea(nativeArea(profileById(w.modelProfile)?.defaults), r.w, r.h);
          s.ratio = r.id;
          // A size of one's own stays: Custom, unless it already is the model's default.
          if (!s.sizeMode) s.sizeMode = t.width === w.width && t.height === w.height ? 'model' : 'custom';
          if (!s.inputSize) s.inputSize = 'custom';
        }
        // Item 34: "Picture size" is gone; its long side stays as Custom (nothing jumps).
        if (s.inputSize && !PRESETS.includes(s.inputSize)) s.inputSize = 'custom';
        if (s.sizeMode && !PRESETS.includes(s.sizeMode)) s.sizeMode = 'custom';
        return { ...cur, ...s };
      },
    },
  ),
);

/** The current model type's native pixel count. */
export function useNativeArea(): number {
  const profile = useStore((s) => s.workflow.modelProfile);
  return nativeArea(profileById(profile)?.defaults);
}

/** Keeps the store's size on Model default (and an input picture's long side) while chosen. Mount once. */
export function useCompositionSync(): void {
  const area = useNativeArea();
  const ratio = useComposition((s) => s.ratio);
  const sizeMode = useComposition((s) => s.sizeMode);
  const inputSize = useComposition((s) => s.inputSize);
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const input = useStore((s) => s.workflow.inputImage);
  const maxSize = useStore((s) => s.workflow.inputMaxSize);
  const minSize = useStore((s) => s.workflow.inputMinSize);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const iw = input?.width ?? 0;
  const ih = input?.height ?? 0;
  useEffect(() => {
    if (sizeMode === 'custom') return;
    const r = ratioById(ratio);
    const t = sizeForArea(presetArea(area, sizeMode), r.w, r.h);
    if (t.width !== width || t.height !== height) setWorkflow(t);
  }, [sizeMode, ratio, area, width, height, setWorkflow]);
  useEffect(() => {
    if (!iw || !ih || inputSize === 'custom') return;
    const l = nativeLongSide(iw, ih, presetArea(area, inputSize));
    if (maxSize !== l || minSize !== l) setWorkflow({ inputMaxSize: l, inputMinSize: l });
  }, [iw, ih, inputSize, area, maxSize, minSize, setWorkflow]);
}

/** `useCompositionSync` as a component (App mounts `<CompositionSync />`). */
export function CompositionSync(): null {
  useCompositionSync();
  return null;
}
