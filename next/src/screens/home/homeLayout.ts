/**
 * Home masonry maths (fix list 2 #14), pure (tests/homeLayout.test.cjs): how many columns fit, the
 * row-order deal of tiles into columns, and the ghost tiles that fill each column's empty space
 * down to the page bottom (varied heights, never a sliver).
 */

/** Columns that fit `width` at `colW` minimum per column (at least 1). */
export function columnsFor(width: number, colW: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (colW + gap)));
}

/** Deal items into `cols` columns in reading order: 0 1 2 / 3 4 5 … */
export function deal<T>(items: readonly T[], cols: number): T[][] {
  const out: T[][] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => out[i % cols].push(it));
  return out;
}

/** Height factors (× column width) the ghosts cycle through, offset per column so they don't line up. */
const PATTERN = [1.25, 0.8, 1.5, 1.05, 0.7, 1.35];

/**
 * Ghost heights per column: each column is filled from its real height down to `target`. A ghost
 * is at least `minH` tall; a left-over gap smaller than that stays empty; the last ghost stretches
 * to swallow a gap that would be too small for one more.
 */
export function ghostsFor(colHeights: readonly number[], target: number, colW: number, gap: number, minH = 64, max = 40): number[][] {
  let total = 0;
  return colHeights.map((h, c) => {
    const out: number[] = [];
    let left = target - h - (h > 0 ? gap : 0);
    let k = c * 2;
    while (left >= minH && total < max) {
      let g = Math.round(PATTERN[k++ % PATTERN.length] * colW);
      if (left - g - gap < minH) g = left;
      out.push(g);
      total += 1;
      left -= g + gap;
    }
    return out;
  });
}
