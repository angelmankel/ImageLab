/**
 * Item 13, the GPU canvas camera, pure (tests/gpuView.test.cjs). Same model as the classic engine
 * (`@/lib/canvasController`): the view is the world point at the viewport centre plus a zoom; the
 * picture sits at world (0, 0) at its pixel size, so picture px = world units. Fit centres the
 * picture in the part of the viewport not covered by insets (the Edit mode's floating tool bar).
 */
export interface View { cx: number; cy: number; z: number }
export interface Insets { left: number; top: number; right: number; bottom: number }
export interface Pt { x: number; y: number }

export const NO_INSETS: Insets = Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 });

/** The view that fits a W × H picture into vw × vh minus insets and `pad` on every side, never above `maxZ`. */
export function fitView(W: number, H: number, vw: number, vh: number, ins: Insets = NO_INSETS, pad = 0, maxZ = Infinity): View {
  if (!(W > 0 && H > 0 && vw > 0 && vh > 0)) return { cx: W / 2 || 0, cy: H / 2 || 0, z: 1 };
  const aw = Math.max(1, vw - ins.left - ins.right - pad * 2);
  const ah = Math.max(1, vh - ins.top - ins.bottom - pad * 2);
  const z = Math.min(aw / W, ah / H, maxZ);
  // The picture's centre lands on the centre of the free area, not of the viewport.
  const sx = ins.left + pad + aw / 2;
  const sy = ins.top + pad + ah / 2;
  return { cx: W / 2 - (sx - vw / 2) / z, cy: H / 2 - (sy - vh / 2) / z, z };
}

export const toScreen = (v: View, vw: number, vh: number, p: Pt): Pt => ({ x: (p.x - v.cx) * v.z + vw / 2, y: (p.y - v.cy) * v.z + vh / 2 });
export const toWorld = (v: View, vw: number, vh: number, s: Pt): Pt => ({ x: (s.x - vw / 2) / v.z + v.cx, y: (s.y - vh / 2) / v.z + v.cy });

/** Zoom by `factor` about the screen point s (kept still), the zoom clamped to [minZ, maxZ]. */
export function zoomAt(v: View, factor: number, s: Pt, vw: number, vh: number, minZ: number, maxZ: number): View {
  const z = Math.min(maxZ, Math.max(minZ, v.z * factor));
  if (z === v.z) return v;
  const w = toWorld(v, vw, vh, s);
  return { cx: w.x - (s.x - vw / 2) / z, cy: w.y - (s.y - vh / 2) / z, z };
}

/** Pan by a screen delta. */
export const panBy = (v: View, dx: number, dy: number): View => ({ cx: v.cx - dx / v.z, cy: v.cy - dy / v.z, z: v.z });

/** Close enough to `fit` to call it fitted (the toolbar's Fit state, the drag-to-dnd rule). */
export const isFitted = (v: View, fit: View) => Math.abs(v.z - fit.z) / fit.z < 0.01 && Math.abs(v.cx - fit.cx) * v.z < 1 && Math.abs(v.cy - fit.cy) * v.z < 1;

/** The grid: minor step and alphas so lines never get denser than ~8 screen px (classic look). */
export function gridSpec(z: number, base = 64): { step: number; minor: number; major: number } {
  let step = base;
  while (step * z < 12) step *= 2;
  while (step * z > 96 && step > 8) step /= 2;
  const px = step * z;
  return { step, minor: Math.min(0.07, Math.max(0, (px - 6) / 120)), major: 0.12 };
}
