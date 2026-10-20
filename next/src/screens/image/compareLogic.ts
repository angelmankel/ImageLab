/**
 * Item 23, Compare: the pure part (tested in tests/compare.test.cjs). Which result the shown one is
 * compared against, how the "before" side steps through the list, the split position from a
 * pointer, and the fitted box both pictures share. Imports nothing.
 */

export interface CompareItem { key: string; kind: 'image' | 'video' }

/**
 * The other side: the picked key when it is still in the list (and not the shown one); else the
 * shown picture's source (a Remove BG cut-out → its original); else the previous (older) image;
 * else the newer one. -1 = nothing to compare with.
 */
export function compareIndex(items: readonly CompareItem[], shown: number, pickedKey: string | null, sourceKey: string | null): number {
  const ok = (i: number) => i >= 0 && i < items.length && i !== shown && items[i].kind === 'image';
  if (pickedKey) { const i = items.findIndex((it) => it.key === pickedKey); if (ok(i)) return i; }
  if (sourceKey) { const i = items.findIndex((it) => it.key === sourceKey); if (ok(i)) return i; }
  for (let i = shown + 1; i < items.length; i++) if (ok(i)) return i;
  for (let i = shown - 1; i >= 0; i--) if (ok(i)) return i;
  return -1;
}

/** Step the "before" side by `dir` (+1 = older), skipping the shown one and videos; wraps. */
export function stepCompare(items: readonly CompareItem[], shown: number, current: number, dir: 1 | -1): number {
  const n = items.length;
  if (n < 2) return current;
  let i = current;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (i !== shown && items[i].kind === 'image') return i;
  }
  return current;
}

/** The divider position in % (0..100) for a pointer at clientX over a box. */
export function splitAt(clientX: number, left: number, width: number): number {
  if (width <= 0) return 50;
  return Math.min(100, Math.max(0, ((clientX - left) / width) * 100));
}

/** The box a picture of natural size w × h takes when contained in cw × ch, centred. */
export function fitBox(w: number, h: number, cw: number, ch: number): { left: number; top: number; width: number; height: number } {
  if (!(w > 0 && h > 0 && cw > 0 && ch > 0)) return { left: 0, top: 0, width: Math.max(0, cw), height: Math.max(0, ch) };
  const s = Math.min(cw / w, ch / h);
  const width = w * s; const height = h * s;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}
