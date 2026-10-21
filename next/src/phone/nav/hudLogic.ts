/**
 * The HUD ring's geometry (mobile pass, m-shell; Donny 10-21: "the center of the circle hud … the
 * globals"). Pure; tests load it from source.
 *
 * Two arcs round the circle: the inner one = the things you do (Undo · Generate · Jobs · Redo),
 * the outer one = the places (History · Models · ComfyUI · Sessions · Settings · Mute). Home is
 * the circle itself, in the centre. Portrait: the arcs open upwards from the bottom-centre circle;
 * landscape: leftwards from the circle at the right edge.
 */

export const RING_ITEM = 52;
export const RING_INNER = 92;
export const RING_OUTER = 166;
/** Closest an item's centre may come to the window edge. */
export const RING_EDGE = RING_ITEM / 2 + 4;

export interface RingSpot { x: number; y: number }

/** n points on an arc of radius r from angle a0 to a1 (degrees, 0 = right, 90 = up), relative to the centre. */
export function arc(n: number, r: number, a0: number, a1: number): RingSpot[] {
  if (n <= 0) return [];
  if (n === 1) { const a = ((a0 + a1) / 2) * Math.PI / 180; return [{ x: r * Math.cos(a), y: -r * Math.sin(a) }]; }
  return Array.from({ length: n }, (_, i) => {
    const a = (a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI / 180;
    return { x: Math.round(r * Math.cos(a)), y: Math.round(-r * Math.sin(a)) };
  });
}

/**
 * The two arcs for a circle at (cx, cy) in a window w × h. Portrait opens up; landscape opens left.
 * The outer radius shrinks on a narrow / short window so every target stays on screen.
 */
export function ringLayout(inner: number, outer: number, cx: number, cy: number, w: number, h: number, landscape: boolean): { inner: RingSpot[]; outer: RingSpot[] } {
  if (!landscape) {
    const room = Math.min(cx, w - cx) - RING_EDGE;
    const ro = Math.max(RING_INNER + RING_ITEM + 6, Math.min(RING_OUTER, room / Math.cos(15 * Math.PI / 180)));
    return { inner: arc(inner, RING_INNER, 160, 20), outer: arc(outer, ro, 165, 15) };
  }
  const room = Math.min(cy, h - cy) - RING_EDGE;
  const ro = Math.max(RING_INNER + RING_ITEM + 6, Math.min(RING_OUTER, room / Math.cos(15 * Math.PI / 180)));
  return { inner: arc(inner, RING_INNER, 110, 250), outer: arc(outer, ro, 105, 255) };
}

/** The item under a finger (relative to the centre), or -1; `spots` in one list, inner first. */
export function ringHit(spots: RingSpot[], dx: number, dy: number, radius = RING_ITEM / 2 + 10): number {
  let best = -1; let bestD = radius;
  spots.forEach((s, i) => {
    const d = Math.hypot(s.x - dx, s.y - dy);
    if (d <= bestD) { best = i; bestD = d; }
  });
  return best;
}
