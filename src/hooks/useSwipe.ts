import { useEffect, useRef, type RefObject } from 'react';
import { swipeAxis, swipeCommits, swipeOffset } from '@/lib/swipe';

/**
 * A touch that starts on one of these is theirs, never a swipe: text boxes, sliders, number
 * steppers, drag handles, and anything marked `data-no-swipe`.
 */
const OWN_GESTURE = 'input, textarea, select, [contenteditable="true"], [role="slider"], .mantine-Slider-root, .mantine-RangeSlider-root, [data-no-swipe], [aria-roledescription="sortable"]';

/** True when something between the touch and the root scrolls sideways (a chip row, a tab bar). */
function scrollsSideways(from: Element | null, root: Element): boolean {
  for (let el = from; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

/**
 * A one-way horizontal swipe on `ref` (dir +1 = to the right). `onMove` gets the finger's offset
 * while it is dragging (0 again on release); `onSwipe` fires when the release counts. Touch
 * only: a mouse drag selects text. The root wants `touch-action: pan-y` so the browser leaves
 * sideways moves to us and keeps vertical scrolling.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, opts: {
  dir: 1 | -1;
  enabled: boolean;
  onSwipe: () => void;
  onMove?: (dx: number) => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const root = ref.current;
    if (!root || !opts.enabled) return;
    let start: { id: number; x: number; y: number; t: number } | null = null;
    let axis: 'x' | 'y' | null = null;
    let dx = 0;
    let swallow = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      const target = e.target as Element | null;
      if (target?.closest(OWN_GESTURE) || scrollsSideways(target, root)) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
      axis = null;
      dx = 0;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id || axis === 'y') return;
      const { dir, onMove } = latest.current;
      dx = e.clientX - start.x;
      if (!axis) {
        axis = swipeAxis(dx, e.clientY - start.y, dir);
        if (axis !== 'x') return;
        try { root.setPointerCapture(e.pointerId); } catch { /* the pointer may be gone */ }
      }
      onMove?.(swipeOffset(dx, dir));
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const { dir, onMove, onSwipe } = latest.current;
      const swiped = axis === 'x' && e.type === 'pointerup' && swipeCommits(dx, e.timeStamp - start.t, root.clientWidth, dir);
      if (axis === 'x') {
        onMove?.(0);
        swallow = true;
        setTimeout(() => { swallow = false; }, 0);
      }
      start = null;
      axis = null;
      if (swiped) onSwipe();
    };
    // A swipe that ends on a button must not also press it.
    const click = (e: MouseEvent) => {
      if (swallow) { e.preventDefault(); e.stopPropagation(); }
    };

    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('click', click, true);
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      root.removeEventListener('click', click, true);
    };
  }, [ref, opts.enabled]);
}
