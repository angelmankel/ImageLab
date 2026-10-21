/**
 * Keep the keyboard-highlighted row visible (FIXLIST-2 item 39), the pure part: the scroll
 * position that brings an item fully into its scroller's view, moving as little as possible
 * ("nearest"), with a small margin so the row never sits flush on the edge. null = already in view.
 */
export function nearestScroll(viewStart: number, viewSize: number, itemStart: number, itemSize: number, margin = 4): number | null {
  const s = itemStart - margin;
  const e = itemStart + itemSize + margin;
  if (s >= viewStart && e <= viewStart + viewSize) return null;
  // Taller than the view: show its start.
  if (e - s > viewSize || s < viewStart) return Math.max(0, s);
  return Math.max(0, e - viewSize);
}
