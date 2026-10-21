/** The HUD ring's open state + the sheets it opens (mobile pass, m-shell). */
import { create } from 'zustand';

export interface HudState {
  open: boolean;
  /** Opened by a press-drag (release picks) rather than a tap (tap picks). */
  drag: boolean;
  /** The item under the finger while dragging (index in inner + outer), -1 none. */
  hover: number;
  /** The circle's centre in CSS px, measured when it opened. */
  at: { x: number; y: number } | null;
  sheet: 'jobs' | 'sessions' | null;
}

export const useHud = create<HudState>(() => ({ open: false, drag: false, hover: -1, at: null, sheet: null }));
export const closeRing = () => useHud.setState({ open: false, drag: false, hover: -1 });
export const openSheet = (sheet: HudState['sheet']) => useHud.setState({ open: false, drag: false, hover: -1, sheet });
