/**
 * The phone shell's arithmetic (rules 11 and 15), kept pure so `tests/phone.test.cjs` loads it
 * straight from source. Imports nothing.
 *
 *  - Generate: a tap generates, a HOLD of HOLD_MS switches between "seed as set" (bolt) and
 *    "random seed" (dice); a finger that wanders off is neither. While this step's job runs the
 *    button is Stop.
 *  - The step pager: a page swipe one way goes to the neighbouring step, the ends rubber-band.
 */

/** How long a press must last to count as a hold (switch the seed mode). */
export const HOLD_MS = 500;
/** A finger that moves this far during a press is a scroll / swipe, not a tap or a hold. */
export const HOLD_MOVE_PX = 10;
/** The gap between step pages while one slides in (matches the viewer's SLIDE_GAP). */
export const PAGE_GAP = 24;
/** The page slide after a committed swipe. */
export const PAGE_SLIDE_MS = 240;

export type SeedMode = 'set' | 'random';
export type PressOutcome = 'tap' | 'hold' | 'cancel';
export type GenerateFace = 'bolt' | 'dice' | 'stop';

/** What a press on Generate was, from how long it lasted and how far the finger moved. */
export function pressOutcome(heldMs: number, movedPx: number): PressOutcome {
  if (movedPx > HOLD_MOVE_PX) return 'cancel';
  return heldMs >= HOLD_MS ? 'hold' : 'tap';
}

export const toggleSeedMode = (m: SeedMode): SeedMode => (m === 'set' ? 'random' : 'set');

/** What the big button shows. */
export function generateFace(running: boolean, mode: SeedMode): GenerateFace {
  if (running) return 'stop';
  return mode === 'random' ? 'dice' : 'bolt';
}

/** The count badge on Generate: every job still to finish (running + queued); null hides it. */
export function badgeText(n: number): string | null {
  if (!(n > 0)) return null;
  return n > 9 ? '9+' : String(n);
}

/**
 * The step a page swipe lands on. `fingerDir` is where the finger went: -1 = left (the next step
 * slides in from the right), +1 = right (the previous step). Null at either end.
 */
export function stepForSwipe(index: number, fingerDir: 1 | -1, len: number): number | null {
  const i = index - fingerDir;
  return i >= 0 && i < len ? i : null;
}

/** The track offset while the finger drags: 1:1 towards a neighbour, rubber-banded at an end. */
export function pageDragOffset(dx: number, hasNeighbour: boolean, width: number): number {
  if (hasNeighbour || dx === 0) return dx;
  const w = Math.max(1, width);
  const d = Math.abs(dx);
  return Math.sign(dx) * (1 - 1 / ((d * 0.55) / w + 1)) * w;
}

/** Where the track settles after a committed swipe (the neighbour fully in view). */
export const pageSettleOffset = (fingerDir: 1 | -1, width: number): number => fingerDir * (width + PAGE_GAP);

/** "1 · Image". */
export const stepChipLabel = (index: number, kindLabel: string): string => `${index + 1} · ${kindLabel}`;

/** A job's progress in whatever shape it comes (0..1, or ComfyUI's {value, max}) as 0..1, or null. */
export function progressFraction(p: unknown): number | null {
  if (typeof p === 'number' && Number.isFinite(p)) return Math.max(0, Math.min(1, p > 1 ? p / 100 : p));
  if (p && typeof p === 'object') {
    const { value, max } = p as { value?: unknown; max?: unknown };
    if (typeof value === 'number' && typeof max === 'number' && max > 0) return Math.max(0, Math.min(1, value / max));
  }
  return null;
}

/**
 * Whether a queue row belongs to this step. Rows that know their step match by id; rows that do not
 * (the main store's image jobs) belong to the first image step.
 */
export function rowIsStep(rowStepId: string | undefined, stepId: string, stepIsFirstImage: boolean): boolean {
  return rowStepId ? rowStepId === stepId : stepIsFirstImage;
}
