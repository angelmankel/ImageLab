/**
 * A two-way horizontal swipe on the phone's picture (rule 11: swipe = next / previous image).
 * The same thresholds as the main app's `@/lib/swipe` (axis lock, a third of the width or a
 * flick), one pointer handler for both directions. Touch only; the root wants
 * `touch-action: pan-y` so vertical scrolling stays the browser's — never fought.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { swipeAxis, swipeCommits } from '@/lib/swipe';

export function useHorizontalSwipe(ref: RefObject<HTMLElement | null>, opts: { enabled: boolean; onLeft: () => void; onRight: () => void }) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const root = ref.current;
    if (!root || !opts.enabled) return;
    let start: { id: number; x: number; y: number; t: number } | null = null;
    let axis: 'x' | 'y' | null = null;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
      axis = null;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id || axis) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      axis = swipeAxis(dx, dy, dx < 0 ? -1 : 1);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const ms = e.timeStamp - start.t;
      const was = axis;
      start = null;
      axis = null;
      if (was !== 'x' || e.type !== 'pointerup') return;
      const dir: 1 | -1 = dx < 0 ? -1 : 1;
      if (!swipeCommits(dx, ms, root.clientWidth, dir)) return;
      if (dir < 0) latest.current.onLeft(); else latest.current.onRight();
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
    };
  }, [ref, opts.enabled]);
}
