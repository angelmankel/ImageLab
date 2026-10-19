/**
 * What the desktop workspace remembers between visits: which settings cards are folded in each
 * mode, whether each side column is open, how tall the results strip is, how many columns the
 * results grid has. The side-column widths stay in `layout/panelLayout.ts`. A per-browser
 * convenience, so storage may fail without harm.
 *
 * `picked` (which video / workflow result the hero shows) is session state the hero and the right
 * column share; it is not persisted, and null means "follow the newest".
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceMode } from '@/lib/workspace';
import {
  DEFAULT_FOLDED, OLD_VIDEO_FOLDED_KEY, STRIP_LIMITS, clampStrip, cleanFolded, toggleFolded, unfold,
} from '@/lib/desktopLayout';

type Folded = Record<WorkspaceMode, string[]>;
type Picked = Record<WorkspaceMode, string | null>;

interface DesktopLayoutState {
  folded: Folded;
  leftOpen: boolean;
  rightOpen: boolean;
  /** Thumbnail size of the strip under the hero, in px. */
  strip: number;
  /** Columns of the video / workflow results grid. */
  gridColumns: number;
  picked: Picked;
  toggleFold: (mode: WorkspaceMode, id: string) => void;
  unfold: (mode: WorkspaceMode, id: string) => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  setStrip: (px: number) => void;
  setGridColumns: (n: number) => void;
  setPicked: (mode: WorkspaceMode, key: string | null) => void;
}

/** The old Video view's fold state becomes video's start, so nothing changes on first open. */
function initialFolded(): Folded {
  let video: string[] = [...DEFAULT_FOLDED.video];
  try {
    const raw = JSON.parse(localStorage.getItem(OLD_VIDEO_FOLDED_KEY) || 'null');
    if (Array.isArray(raw)) video = cleanFolded(raw, ['mode', 'prompt', 'models', 'loras', 'size', 'speed', 'upscale']);
  } catch { /* blocked or broken: the default */ }
  return { image: [...DEFAULT_FOLDED.image], video, workflow: [...DEFAULT_FOLDED.workflow] };
}

const clampColumns = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.max(2, Math.min(5, n))) : 3;

export const useDesktopLayout = create<DesktopLayoutState>()(
  persist(
    (set) => ({
      folded: initialFolded(),
      leftOpen: true,
      rightOpen: true,
      strip: STRIP_LIMITS.default,
      gridColumns: 3,
      picked: { image: null, video: null, workflow: null },
      toggleFold: (mode, id) => set(s => ({ folded: { ...s.folded, [mode]: toggleFolded(s.folded[mode], id) } })),
      unfold: (mode, id) => set(s => ({ folded: { ...s.folded, [mode]: unfold(s.folded[mode], id) } })),
      setLeftOpen: (leftOpen) => set({ leftOpen }),
      setRightOpen: (rightOpen) => set({ rightOpen }),
      setStrip: (px) => set({ strip: clampStrip(px) }),
      setGridColumns: (n) => set({ gridColumns: clampColumns(n) }),
      setPicked: (mode, key) => set(s => ({ picked: { ...s.picked, [mode]: key } })),
    }),
    {
      name: 'imagelab.desktopLayout.v1',
      partialize: (s) => ({ folded: s.folded, leftOpen: s.leftOpen, rightOpen: s.rightOpen, strip: s.strip, gridColumns: s.gridColumns }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DesktopLayoutState>;
        return {
          ...current,
          folded: { ...current.folded, ...(p.folded ?? {}) },
          leftOpen: p.leftOpen ?? true,
          rightOpen: p.rightOpen ?? true,
          strip: clampStrip(p.strip),
          gridColumns: clampColumns(p.gridColumns),
        };
      },
    },
  ),
);
