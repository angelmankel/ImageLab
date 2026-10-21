/** The toolbar's view of a zoomable stage (the DOM stage's `useStageZoom` and the GPU canvas both fit it). */
import type { GpuCanvas } from './engine';

export interface ZoomControls {
  /** 1 = fitted. */
  state: { zoom: number };
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const ZOOM_STEP = 1.25;

/** Controls for a GPU canvas; `state` reads the live zoom. */
export function zoomControlsOf(e: GpuCanvas): ZoomControls {
  return {
    get state() { return { zoom: e.relZoom() }; },
    fit: () => e.fit(),
    zoomIn: () => e.zoomBy(ZOOM_STEP),
    zoomOut: () => e.zoomBy(1 / ZOOM_STEP),
  };
}
