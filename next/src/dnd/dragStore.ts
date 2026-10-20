/**
 * "A picture is being dragged right now" (fix list 42): set by `useImageDrag` for in-app drags and
 * by `DragLayer` for drags that come in from outside the window (files, other tabs). Every drop
 * target reads it to light up while a drag is on, so Donny sees where he can let go.
 */
import { create } from 'zustand';
import type { ImagePayload } from './payload';

export interface DragState {
  /** Null = no drag. `payload` is known for in-app drags; outside drags carry only `external`. */
  dragging: { payload: ImagePayload | null; external: boolean } | null;
  begin: (payload: ImagePayload | null, external: boolean) => void;
  end: () => void;
}

export const useDrag = create<DragState>()((set) => ({
  dragging: null,
  begin: (payload, external) => set({ dragging: { payload, external } }),
  end: () => set({ dragging: null }),
}));

/** True while any picture drag is on (in-app or from outside). */
export const useDragActive = (): boolean => useDrag((s) => s.dragging !== null);
