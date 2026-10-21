/**
 * THE keyboard-list helper (FIXLIST-2 item 39): when ↑ / ↓ (or ← / →) moves a highlight, scroll
 * ONLY the list's own scroll container so the row is fully visible — never the page or a panel
 * further out (`el.scrollIntoView` scrolls every ancestor, even `overflow: hidden` ones).
 *
 *   scrollIntoNearest(rowEl)                       // finds the nearest scrolling ancestor
 *   useScrollIntoView(listRef, hl)                 // after each change of `hl`, scrolls the row
 *                                                  // marked aria-selected="true" / data-active /
 *                                                  // .is-hl / aria-current into view
 * Instant (a key repeat must keep up); both axes; works under the UI zoom (ratios only).
 */
import { useLayoutEffect, type RefObject } from 'react';
import { nearestScroll } from './scrollLogic';

const ACTIVE = '[aria-selected="true"], [data-active="true"], [data-hl="true"], .is-hl, [aria-current="true"]';

function scrolls(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const st = getComputedStyle(el);
  const ov = axis === 'y' ? st.overflowY : st.overflowX;
  if (ov !== 'auto' && ov !== 'scroll') return false;
  return axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/** The nearest ancestor that scrolls on that axis (stops at, and includes, `stop`). */
export function scrollParent(el: HTMLElement, axis: 'x' | 'y' = 'y', stop?: HTMLElement | null): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (scrolls(p, axis)) return p;
    if (p === stop) return null;
  }
  return null;
}

/** Scroll `el`'s own scroller(s) — just enough — so `el` is fully visible. */
export function scrollIntoNearest(el: Element | null | undefined, opts: { container?: HTMLElement | null; margin?: number; axis?: 'x' | 'y' | 'both' } = {}) {
  if (!(el instanceof HTMLElement)) return;
  const axis = opts.axis ?? 'both';
  const margin = opts.margin ?? 4;
  for (const ax of axis === 'both' ? (['y', 'x'] as const) : [axis]) {
    const box = opts.container && scrolls(opts.container, ax) ? opts.container : scrollParent(el, ax, opts.container);
    if (!box) continue;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // Rects are window px; scrollTop is the box's own CSS px: scale by the box's rect / layout size.
    const k = (ax === 'y' ? b.height / (box.offsetHeight || 1) : b.width / (box.offsetWidth || 1)) || 1;
    if (ax === 'y') {
      const itemStart = (r.top - b.top) / k - box.clientTop + box.scrollTop;
      const next = nearestScroll(box.scrollTop, box.clientHeight, itemStart, r.height / k, margin);
      if (next != null) box.scrollTop = next;
    } else {
      const itemStart = (r.left - b.left) / k - box.clientLeft + box.scrollLeft;
      const next = nearestScroll(box.scrollLeft, box.clientWidth, itemStart, r.width / k, margin);
      if (next != null) box.scrollLeft = next;
    }
  }
}

/**
 * After `key` changes (the highlight index / id), scroll the active row of `listRef` into view.
 * `selector` overrides how the active row is found.
 */
export function useScrollIntoView(listRef: RefObject<HTMLElement | null>, key: unknown, opts: { selector?: string; margin?: number; axis?: 'x' | 'y' | 'both'; enabled?: boolean } = {}) {
  const { selector = ACTIVE, margin, axis, enabled = true } = opts;
  useLayoutEffect(() => {
    if (!enabled) return;
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(selector);
    if (row) scrollIntoNearest(row, { container: list, margin, axis });
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
