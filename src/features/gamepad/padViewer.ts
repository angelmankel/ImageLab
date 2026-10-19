/**
 * The one place the controller touches results and the fullscreen viewers: stepping the shown
 * result, opening it, and stepping / closing the viewer. The viewers are not edited for it: the
 * viewer is found by what it already is (a full-screen `data-no-swipe` overlay, or anything that
 * opts in with `data-pad-layer="viewer"`), and it is stepped and closed through what it already
 * answers to — the image viewer through the store, the rest through the arrow keys and Escape they
 * listen for, exactly as a keyboard drives them. The image viewer and the touch video player
 * register their own animated next / previous / close (`components/viewerTransition`
 * `registerViewer`), which `viewerStep` / `viewerClose` prefer; the keys are the fallback.
 */
import { useEffect, useRef } from 'react';
import { activeViewer } from '@/components/viewerTransition';
import { useStore } from '@/lib/store';
import { stepResult } from '@/lib/desktopLayout';
import type { WorkspaceMode } from '@/lib/workspace';

/** Matches the open viewer; `padDom` treats it as an overlay the highlight stays inside. */
export const VIEWER = '[data-pad-layer="viewer"], [data-no-swipe].fixed.inset-0';

export const isViewer = (layer: Element | null) => !!layer?.matches(VIEWER);

function key(k: 'Escape' | 'ArrowLeft' | 'ArrowRight', on: EventTarget) {
  on.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, cancelable: true }));
}

/** Previous / next picture: -1 is ←, 1 is →, as the arrow keys. */
export function viewerStep(dir: 1 | -1) {
  const v = activeViewer();
  if (v) { v.step(dir); return; }
  key(dir < 0 ? 'ArrowLeft' : 'ArrowRight', window);
}

/** Close it: the image viewer is store state; the others close on Escape. */
export function viewerClose(viewer: HTMLElement) {
  const v = activeViewer();
  if (v) { v.close(); return; } // animated; it tells its owner (the store, for the image viewer) when done
  const st = useStore.getState();
  if (st.viewerOpen) { st.closeViewer(); return; }
  key('Escape', viewer);
}

// ── Results outside the viewer ──────────────────────────────────────────────

/** A shell's results, for the modes whose pick lives in component state. */
export interface PadResults {
  /** +1 older, -1 newer, as ←/→ on the keyboard. */
  step: (dir: 1 | -1) => void;
  /** Open the shown result full screen. */
  open: () => void;
}

const handles: { current: PadResults }[] = [];

/** Register while mounted; the latest mounted wins. Handlers are read through a ref. */
export function usePadResults(target: PadResults) {
  const ref = useRef(target);
  ref.current = target;
  useEffect(() => {
    const h = { get current() { return ref.current; } };
    handles.push(h);
    return () => { handles.splice(handles.indexOf(h), 1); };
  }, []);
}

export function stepResults(mode: WorkspaceMode, dir: 1 | -1) {
  if (mode === 'image') {
    const st = useStore.getState();
    const cur = st.selectedEntry ?? st.history[0] ?? null;
    const i = stepResult(cur ? st.history.findIndex(h => h.id === cur.id) : -1, st.history.length, dir);
    if (st.history[i]) st.selectHistoryEntry(st.history[i]);
    return;
  }
  handles[handles.length - 1]?.current.step(dir);
}

export function openResult(mode: WorkspaceMode) {
  if (mode === 'image') { if (useStore.getState().history.length) useStore.getState().openViewer(); return; }
  handles[handles.length - 1]?.current.open();
}
