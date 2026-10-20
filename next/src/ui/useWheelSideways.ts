/**
 * A mouse wheel scrolls a sideways row (the Style thumbs, the toolbar): an up/down wheel turn moves
 * it left/right while it can still move that way, then the page scrolls as usual. A trackpad's own
 * sideways swipe (deltaX) is left to the browser. Returns a callback ref for the scroller.
 */
import { useCallback, useRef } from 'react';

export function useWheelSideways<T extends HTMLElement>(): (el: T | null) => void {
  const off = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    off.current?.();
    off.current = null;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if ((dy < 0 && el.scrollLeft <= 0) || (dy > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += dy;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    off.current = () => el.removeEventListener('wheel', wheel);
  }, []);
}
