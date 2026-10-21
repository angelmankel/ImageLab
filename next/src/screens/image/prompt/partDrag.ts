/**
 * Item 44 (fix): the maths of dragging a prompt part, on plain line boxes so it is tested in node
 * (`tests/smartPrompt.test.cjs`). A part may wrap: it is then several boxes (one per line, as
 * `getClientRects()` gives them), first to last. Over a part's middle = SWAP with it; over its
 * leading quarter (on its first line box) = MOVE before it; over its trailing quarter (on its last
 * line box) = MOVE after it; anywhere else (a gap, between lines, past the end) = MOVE next to the
 * nearest box. Dropping on itself, or moving to where it already is, does nothing.
 */

export interface Box { left: number; top: number; right: number; bottom: number }
/** One part's line boxes, in reading order. */
export interface PartBoxes { i: number; boxes: Box[] }

export interface DropTarget {
  mode: 'swap' | 'move';
  /** swap: the part index; move: the slot (0 = before the first part, n = after the last). -1 = no-op. */
  to: number;
  /** Where to draw: the swap target's index, or the insert line (x, top, height). */
  line: { x: number; top: number; h: number } | null;
}

const EDGE = 0.25;
const EDGE_MIN = 10;
const SLACK_X = 3;
const SLACK_Y = 2;

const inside = (b: Box, x: number, y: number) => x >= b.left - SLACK_X && x <= b.right + SLACK_X && y >= b.top - SLACK_Y && y <= b.bottom + SLACK_Y;

/** The part (index into `parts`' `i`) whose box contains (x, y), with that box's position in the part. */
export function hitBox(parts: PartBoxes[], x: number, y: number): { i: number; k: number; box: Box; count: number } | null {
  for (const p of parts) {
    for (let k = 0; k < p.boxes.length; k++) if (inside(p.boxes[k], x, y)) return { i: p.i, k, box: p.boxes[k], count: p.boxes.length };
  }
  return null;
}

/** Normalise a move: slot `from` or `from + 1` = the part stays where it is. */
const moveTo = (from: number, slot: number) => (slot === from || slot === from + 1 ? -1 : slot);

/** Where a part dragged from `from` would land with the pointer at (x, y). */
export function dropTarget(parts: PartBoxes[], from: number, x: number, y: number): DropTarget {
  const hit = hitBox(parts, x, y);
  if (hit) {
    const { i, k, box, count } = hit;
    const w = box.right - box.left;
    const edge = Math.max(EDGE_MIN, w * EDGE);
    const before = k === 0 && x < box.left + Math.min(edge, w / 2);
    const after = k === count - 1 && x > box.right - Math.min(edge, w / 2);
    if (before || after) {
      const slot = before ? i : i + 1;
      const to = moveTo(from, slot);
      return { mode: 'move', to, line: to < 0 ? null : { x: before ? box.left - 3 : box.right + 2, top: box.top, h: box.bottom - box.top } };
    }
    return { mode: 'swap', to: i === from ? -1 : i, line: null };
  }
  // Not over a part: next to the nearest line box (rows count more than columns).
  let best: { i: number; box: Box; first: boolean; last: boolean; d: number } | null = null;
  for (const p of parts) {
    p.boxes.forEach((b, k) => {
      const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
      const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      const d = dy * 10 + dx;
      if (!best || d < best.d) best = { i: p.i, box: b, first: k === 0, last: k === p.boxes.length - 1, d };
    });
  }
  if (!best) return { mode: 'move', to: -1, line: null };
  const b = best as { i: number; box: Box; first: boolean; last: boolean };
  // Left of the box's middle on the part's first line → before it; otherwise after it.
  const before = b.first && x < (b.box.left + b.box.right) / 2;
  const slot = before ? b.i : b.i + 1;
  const to = moveTo(from, slot);
  return { mode: 'move', to, line: to < 0 ? null : { x: before ? b.box.left - 3 : b.box.right + 2, top: b.box.top, h: b.box.bottom - b.box.top } };
}
