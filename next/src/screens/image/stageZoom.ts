/**
 * The stage's zoom and pan, the pure part (tested in tests/stage.test.cjs and
 * tests/stagePinch.test.cjs): a zoom between 1 (fit) and 8, an offset in CSS pixels, zooming
 * about a point so what is under the cursor stays put, and a two-finger pinch (distance + midpoint
 * of two pointers → zoom 1:1 with the finger spread, the picture point under the midpoint follows
 * the fingers). All points are relative to the picture's centre.
 */
export interface ZoomState { zoom: number; x: number; y: number }
export interface Pt { x: number; y: number }
/** A pinch at one instant: the finger distance and the midpoint (relative to the picture's centre). */
export interface Pinch { d: number; cx: number; cy: number }
/** Where a pinch began: the state then, the distance then, and the picture point under the midpoint. */
export interface PinchStart { s: ZoomState; d: number; ax: number; ay: number }

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 1.25;
export const FIT: ZoomState = { zoom: 1, x: 0, y: 0 };

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/**
 * Set the zoom to `zoom` (clamped) keeping the point (px, py) still: new offset =
 * point − (point − offset) · newZoom / oldZoom. At fit the offset snaps back to 0.
 */
export function zoomTo(s: ZoomState, zoom: number, px = 0, py = 0): ZoomState {
  const z = clampZoom(zoom);
  if (z === s.zoom) return s;
  if (z <= ZOOM_MIN) return FIT;
  const k = z / s.zoom;
  return { zoom: z, x: px - (px - s.x) * k, y: py - (py - s.y) * k };
}

/** Zoom by `factor` about the point (px, py): the wheel, the toolbar buttons. */
export const zoomAbout = (s: ZoomState, factor: number, px = 0, py = 0): ZoomState => zoomTo(s, s.zoom * factor, px, py);

/** Pan by a pointer delta; no-op at fit. */
export const panBy = (s: ZoomState, dx: number, dy: number): ZoomState => (s.zoom <= ZOOM_MIN ? s : { ...s, x: s.x + dx, y: s.y + dy });

/** A wheel delta to a zoom factor: ~2x per 350 px of wheel. */
export const wheelFactor = (deltaY: number) => Math.exp(-deltaY * 0.002);

/**
 * A trackpad pinch arrives as a wheel with ctrlKey and small deltas (a few px per event): a
 * steeper curve than the wheel, ~2x per 70 px, so the picture tracks the fingers.
 */
export const trackpadFactor = (deltaY: number) => Math.exp(-deltaY * 0.01);

/** The distance and midpoint of two pointers (points relative to the picture's centre). */
export const pinchOf = (a: Pt, b: Pt): Pinch => ({ d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 });

/** Remember where a pinch began: the picture point under the midpoint is the anchor the fingers carry. */
export const startPinch = (s: ZoomState, p: Pinch): PinchStart => ({ s, d: p.d, ax: (p.cx - s.x) / s.zoom, ay: (p.cy - s.y) / s.zoom });

/**
 * The state for a pinch now at `p`, from where it started: zoom = start zoom · d / d0 (clamped),
 * and the anchor picture point lands under the new midpoint (so moving both fingers pans).
 * Back at fit the offset snaps to 0. A degenerate start (both fingers on one spot) changes nothing.
 */
export function pinchTo(start: PinchStart, p: Pinch): ZoomState {
  if (start.d <= 0) return start.s;
  const zoom = clampZoom(start.s.zoom * (p.d / start.d));
  if (zoom <= ZOOM_MIN) return FIT;
  return { zoom, x: p.cx - zoom * start.ax, y: p.cy - zoom * start.ay };
}

export const transformOf = (s: ZoomState) => `translate(${s.x}px, ${s.y}px) scale(${s.zoom})`;
