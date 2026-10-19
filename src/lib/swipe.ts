// The phone's horizontal swipes (back from a settings page, over to the Image tab), as plain
// arithmetic so the thresholds are tested. Imports nothing (tests load it straight from source).

/** How far the finger moves before the swipe picks an axis. */
export const SWIPE_LOCK_PX = 10;

/**
 * Which way a touch is going once it has moved far enough: 'x' is a swipe in `dir` (+1 right,
 * -1 left), 'y' anything else (a scroll, or a swipe the other way), null not decided yet. A
 * swipe has to be clearly sideways, so a slightly slanted scroll stays a scroll.
 */
export function swipeAxis(dx: number, dy: number, dir: 1 | -1): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return null;
  return dx * dir > 0 && Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
}

/** On release: the swipe counts past a third of the width, or on a quick flick. */
export function swipeCommits(dx: number, ms: number, width: number, dir: 1 | -1): boolean {
  const d = dx * dir;
  if (d <= 0) return false;
  return d > width / 3 || (d > 40 && d / Math.max(1, ms) > 0.5);
}

/** Where the dragged page sits: follows the finger, never past where it started. */
export function swipeOffset(dx: number, dir: 1 | -1): number {
  return dir > 0 ? Math.max(0, dx) : Math.min(0, dx);
}
