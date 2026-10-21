/**
 * Pull-to-close arithmetic (mobile pass, m-shell), pure so `tests/phonePrimitives.test.cjs` loads it.
 * A sheet / viewer follows the finger 1:1 in its closing direction (resisted the other way), and a
 * release closes it past a share of its size or on a quick flick.
 */

/** Movement before the gesture decides it is a pull (vs a scroll / tap). */
export const PULL_LOCK_PX = 8;
/** Release past this share of the sheet's size closes it. */
export const PULL_CLOSE_SHARE = 0.28;
/** …or past this many px, whichever is smaller (tall sheets need not travel a third of the screen). */
export const PULL_CLOSE_PX = 140;
/** A flick this fast (px/ms) in the closing direction closes from any distance past FLICK_MIN_PX. */
export const PULL_FLICK_SPEED = 0.6;
export const PULL_FLICK_MIN_PX = 30;

/** How far the sheet sits for a finger offset `d` along the closing axis (positive = closing). */
export function pullOffset(d: number): number {
  if (d >= 0) return d;
  // the wrong way: a little give, then stops
  return -Math.min(24, Math.sqrt(-d) * 2);
}

/** The distance that closes a sheet of this size. */
export function closeDistance(size: number): number {
  return Math.max(60, Math.min(PULL_CLOSE_PX, size * PULL_CLOSE_SHARE));
}

/** On release: close or spring back. */
export function pullCloses(d: number, ms: number, size: number): boolean {
  if (d <= 0) return false;
  if (d >= closeDistance(size)) return true;
  return d >= PULL_FLICK_MIN_PX && d / Math.max(1, ms) >= PULL_FLICK_SPEED;
}

/** Whether a move decides for the pull: clearly along the closing axis, the right way. */
export function pullAxis(along: number, across: number): 'pull' | 'other' | null {
  if (Math.hypot(along, across) < PULL_LOCK_PX) return null;
  return along > 0 && Math.abs(along) > Math.abs(across) * 1.2 ? 'pull' : 'other';
}

/** The overlay's opacity while pulled (1 = resting, fades to 0.35 at the close distance ×2). */
export function pullFade(d: number, size: number): number {
  if (d <= 0) return 1;
  return Math.max(0.35, 1 - d / (closeDistance(size) * 2));
}

/** A hold: the finger stayed within `movePx` for `ms`. */
export const HOLD_MS = 500;
export const HOLD_MOVE_PX = 10;
export function holdBroken(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > HOLD_MOVE_PX;
}
