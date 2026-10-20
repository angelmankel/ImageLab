/**
 * Item 4, the pure part of the live preview grid (tests/liveGrid.test.cjs).
 *
 * ComfyUI previews only the first picture of a batch. ImageLabCore (`batch_preview.py`) sends the
 * whole batch as ONE frame: the N pictures side by side, left to right. A frame is that strip when
 * its shape is N pictures wide; an older server's frame is one picture. `stripCount` tells which;
 * `bestGrid` lays the tiles out as large as the stage allows.
 */

/** How many pictures a preview frame holds: `n` when it is N pictures of `aspect` side by side, else 1. */
export function stripCount(natW: number, natH: number, n: number, aspect: number): number {
  if (!(n > 1) || !(natW > 0) || !(natH > 0) || !(aspect > 0)) return 1;
  const ratio = natW / natH / (n * aspect);
  return Math.abs(ratio - 1) < 0.15 ? n : 1;
}

export interface Grid { cols: number; rows: number; tileW: number; tileH: number }

/** The columns that make `count` tiles of `aspect` (w / h) biggest inside W × H with `gap` between. */
export function bestGrid(count: number, aspect: number, W: number, H: number, gap = 6): Grid {
  const n = Math.max(1, Math.floor(count));
  const a = aspect > 0 ? aspect : 1;
  let best: Grid = { cols: 1, rows: n, tileW: 0, tileH: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = Math.max(0, (W - gap * (cols - 1)) / cols);
    const cellH = Math.max(0, (H - gap * (rows - 1)) / rows);
    const tileW = Math.min(cellW, cellH * a);
    if (tileW > best.tileW + 0.5) best = { cols, rows, tileW, tileH: tileW / a };
  }
  return best;
}

/** CSS background for picture `i` of an `n`-wide strip. */
export function stripBackground(i: number, n: number): { backgroundSize: string; backgroundPosition: string } {
  if (n <= 1) return { backgroundSize: '100% 100%', backgroundPosition: '0 0' };
  return { backgroundSize: `${n * 100}% 100%`, backgroundPosition: `${(i / (n - 1)) * 100}% 0` };
}
