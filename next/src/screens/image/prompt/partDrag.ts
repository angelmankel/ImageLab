/**
 * Item 44 (fix): the maths of dragging a prompt part, on plain line boxes so it is tested in node
 * (`tests/smartPrompt.test.cjs`). A part may wrap: it is then several boxes (one per line, as
 * `getClientRects()` gives them), first to last. Over a part = SWAP with it, except a thin band
 * (EDGE_PX) at its very start (first line box) / end (last line box) = MOVE before / after it, so
 * the part under the pointer is the one that lights up (a quarter-width band hid it: the d805039 bug); anywhere else (a gap, between lines, past the end) = MOVE next to the
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

/** The move band at a part's ends (px; at most a quarter of a short box). */
export const EDGE_PX = 12;
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
    const edge = Math.min(EDGE_PX, w / 4);
    const before = k === 0 && x < box.left + edge;
    const after = k === count - 1 && x > box.right - edge;
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

export interface Rect { x: number; y: number; w: number; h: number }

const area = (a: Rect, b: Box) => {
  const w = Math.min(a.x + a.w, b.right) - Math.max(a.x, b.left);
  const h = Math.min(a.y + a.h, b.bottom) - Math.max(a.y, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * Where the floating grip (size w × h) covers the least text (option 2: no gutter). Candidates, in
 * order of preference on a tie: left of the part's first letter, above its first line (start),
 * after its last letter, above its first line (end). `first` / `last` = the part's first / last line
 * box; `others` = every OTHER part's line boxes; all in one space. A candidate past `bounds` is
 * skipped (falls back to the first candidate when all are).
 */
export function placeGrip(first: Box, last: Box, others: Box[], w: number, h: number, bounds: Box): { x: number; y: number; at: 'left' | 'above' | 'after' | 'above-end' } {
  const midF = (first.top + first.bottom) / 2;
  const midL = (last.top + last.bottom) / 2;
  const cands: Array<{ r: Rect; at: 'left' | 'above' | 'after' | 'above-end' }> = [
    { at: 'left', r: { x: first.left - w - 3, y: midF - h / 2, w, h } },
    { at: 'above', r: { x: first.left, y: first.top - h + 3, w, h } },
    { at: 'after', r: { x: last.right + 3, y: midL - h / 2, w, h } },
    { at: 'above-end', r: { x: first.right - w, y: first.top - h + 3, w, h } },
  ];
  let best: { r: Rect; at: 'left' | 'above' | 'after' | 'above-end'; cost: number } | null = null;
  for (const c of cands) {
    const r = c.r;
    if (r.x < bounds.left || r.x + r.w > bounds.right || r.y < bounds.top || r.y + r.h > bounds.bottom) continue;
    const cost = others.reduce((s, b) => s + area(r, b), 0);
    if (!best || cost < best.cost - 0.5) best = { ...c, cost };
  }
  const pick = best ?? { ...cands[0], cost: 0 };
  return { x: pick.r.x, y: pick.r.y, at: pick.at };
}
