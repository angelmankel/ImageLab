/**
 * The stage's zoom and pan, the pure part (tested in tests/stage.test.cjs): a zoom between 1 (fit)
 * and 8, an offset in CSS pixels, zooming about a point so what is under the cursor stays put.
 */
export interface ZoomState { zoom: number; x: number; y: number }

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 1.25;
export const FIT: ZoomState = { zoom: 1, x: 0, y: 0 };

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/**
 * Zoom by `factor` about the point (px, py), given relative to the picture's centre. The offset
 * moves so that point stays under the cursor; at fit the offset snaps back to 0.
 */
export function zoomAbout(s: ZoomState, factor: number, px = 0, py = 0): ZoomState {
  const zoom = clampZoom(s.zoom * factor);
  if (zoom === s.zoom) return s;
  if (zoom <= ZOOM_MIN) return FIT;
  const k = zoom / s.zoom;
  return { zoom, x: px - (px - s.x) * k, y: py - (py - s.y) * k };
}

/** Pan by a pointer delta; no-op at fit. */
export const panBy = (s: ZoomState, dx: number, dy: number): ZoomState => (s.zoom <= ZOOM_MIN ? s : { ...s, x: s.x + dx, y: s.y + dy });

/** A wheel delta to a zoom factor: ~2x per 350 px of wheel. */
export const wheelFactor = (deltaY: number) => Math.exp(-deltaY * 0.002);

export const transformOf = (s: ZoomState) => `translate(${s.x}px, ${s.y}px) scale(${s.zoom})`;
