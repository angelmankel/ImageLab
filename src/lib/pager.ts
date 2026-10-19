// The arithmetic behind swiping through results — the hero, the strip and the fullscreen viewer
// all page through the same numbers. A finger drives the track 1:1; a release pages by distance
// or by flick; the ends rubber-band; everything settles on a spring. Imports only `./swipe` so the
// tests can load it from source.
import { SWIPE_LOCK_PX } from './swipe';

/** Gap between two slides, so a neighbour never touches the one in view. */
export const SLIDE_GAP = 24;
/** A release past this share of the width pages. */
export const PAGE_COMMIT_FRACTION = 0.3;
/** A release at or above this speed (px/ms) pages even from a short drag… */
export const FLICK_VELOCITY = 0.5;
/** …as long as the finger moved at least this far, so a nervous tap never pages. */
export const FLICK_MIN_PX = 20;
/** iOS-style rubber-band stiffness: at 0.55 a 50 px pull moves the track about 25 px. */
export const RUBBER = 0.55;
/** A downward drag past this share of the height closes the viewer. */
export const CLOSE_FRACTION = 0.2;
/** Or a downward flick at this speed (px/ms) after a short drag. */
export const CLOSE_VELOCITY = 0.6;
export const CLOSE_MIN_PX = 30;
/** Two taps this close in time and space zoom in (or back out). */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;
export const DOUBLE_TAP_ZOOM = 2.5;
/** With `prefers-reduced-motion` every slide is a fade this long instead. */
export const REDUCED_MS = 120;

/** How far the track moves for one page. */
export const slideDistance = (width: number) => width + SLIDE_GAP;

export function clampIndex(i: number, len: number): number {
  if (len <= 0) return -1;
  return Math.max(0, Math.min(len - 1, Math.round(i)));
}

/**
 * The resistance past an edge: the further the finger goes, the less the track follows, and it
 * never reaches a full `size`. Sign-preserving.
 */
export function rubberBand(d: number, size: number, c = RUBBER): number {
  if (size <= 0) return 0;
  const a = Math.abs(d);
  return Math.sign(d) * (1 - 1 / ((a * c) / size + 1)) * size;
}

/**
 * Where the track sits for a finger offset `dx` (positive = finger moved right, towards the
 * previous item). Within the list it follows 1:1; past the first or last item it rubber-bands.
 */
export function dragOffset(dx: number, index: number, len: number, width: number): number {
  const atFirst = index <= 0 && dx > 0;
  const atLast = index >= len - 1 && dx < 0;
  return atFirst || atLast ? rubberBand(dx, width) : dx;
}

/**
 * Which way a one-finger drag goes once it has moved far enough: 'x' pages, 'y' is a vertical
 * pull (close), null is not decided yet. Symmetric, unlike `swipeAxis`, because both ways mean
 * something here.
 */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}

/**
 * The index to settle on when the finger lets go at track offset `dx` with velocity `vx` (px/ms):
 * one page over on a flick or past the commit fraction, else back where it was. Never past an end.
 */
export function pageOnRelease(dx: number, vx: number, width: number, index: number, len: number): number {
  if (len <= 1 || dx === 0) return clampIndex(index, len);
  const dir = dx < 0 ? 1 : -1; // finger left → the next item (to the right) comes in
  const flick = Math.abs(vx) >= FLICK_VELOCITY && Math.abs(dx) >= FLICK_MIN_PX && Math.sign(vx) === Math.sign(dx);
  const far = Math.abs(dx) >= width * PAGE_COMMIT_FRACTION;
  return flick || far ? clampIndex(index + dir, len) : clampIndex(index, len);
}

/** 0 at rest, 1 when the pull-down has gone as far as it visibly needs to. */
export function closeProgress(dy: number, height: number): number {
  if (dy <= 0 || height <= 0) return 0;
  return Math.min(1, dy / (height * 0.45));
}

/** The pulled image shrinks a little as it goes, so letting go feels like dropping it. */
export const closeScale = (progress: number) => 1 - 0.35 * Math.max(0, Math.min(1, progress));

/** The release closes past a fifth of the height, or on a downward flick after a short pull. */
export function closeCommits(dy: number, vy: number, height: number): boolean {
  if (dy <= 0) return false;
  return dy >= height * CLOSE_FRACTION || (vy >= CLOSE_VELOCITY && dy >= CLOSE_MIN_PX);
}

// ── Spring ──────────────────────────────────────────────────────────────────

export interface SpringOpts {
  /** k; higher is snappier. */
  stiffness?: number;
  /** c; with the default pair the spring is just under critical and settles in about 300 ms. */
  damping?: number;
}

/** A settle of ~300 ms with a hint of overshoot after a flick, none from rest. */
export const SPRING: Required<SpringOpts> = { stiffness: 320, damping: 32 };

export interface SpringState { x: number; v: number; done: boolean }

/**
 * A unit-mass damped spring from `x0` (px, with velocity `v0` in px/ms) towards 0, as a closed
 * form in time, so a frame can be sampled at any `t` without stepping. Over-damped settings are
 * treated as critical.
 */
export function spring(x0: number, v0: number, opts: SpringOpts = {}): (tMs: number) => SpringState {
  const k = opts.stiffness ?? SPRING.stiffness;
  const c = opts.damping ?? SPRING.damping;
  const w0 = Math.sqrt(k);
  const zeta = Math.min(1, c / (2 * w0));
  const v0s = v0 * 1000; // px/s
  return (tMs) => {
    const t = Math.max(0, tMs) / 1000;
    let x: number;
    let v: number;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const e = Math.exp(-zeta * w0 * t);
      const b = (v0s + zeta * w0 * x0) / wd;
      const cos = Math.cos(wd * t);
      const sin = Math.sin(wd * t);
      x = e * (x0 * cos + b * sin);
      v = e * ((-zeta * w0) * (x0 * cos + b * sin) + wd * (-x0 * sin + b * cos));
    } else {
      const e = Math.exp(-w0 * t);
      const b = v0s + w0 * x0;
      x = e * (x0 + b * t);
      v = e * (b - w0 * (x0 + b * t));
    }
    const done = Math.abs(x) < 0.5 && Math.abs(v) < 20; // under half a pixel, under 20 px/s
    return { x: done ? 0 : x, v: v / 1000, done };
  };
}

// ── Wheel ───────────────────────────────────────────────────────────────────

/**
 * Turns wheel deltas into single steps: one step once the deltas since the last quiet moment add
 * up to `threshold`, then nothing more until the wheel has been quiet for `settleMs` — a trackpad's
 * inertia keeps sending for a second, and that must not page again.
 */
export function createWheelStepper(threshold = 60, settleMs = 160) {
  let acc = 0;
  let last = -Infinity;
  let armed = true;
  return {
    feed(delta: number, t: number): -1 | 0 | 1 {
      if (t - last > settleMs) { acc = 0; armed = true; }
      last = t;
      if (!armed) return 0;
      acc += delta;
      if (Math.abs(acc) < threshold) return 0;
      armed = false;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      return dir;
    },
  };
}

/** The scrollLeft that centres a thumbnail of `width` at `left` in a strip `viewport` wide. */
export function centredScrollLeft(left: number, width: number, viewport: number): number {
  return Math.max(0, left + width / 2 - viewport / 2);
}
