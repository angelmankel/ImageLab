/**
 * Item 13, the GPU canvas's one-pointer gesture, pure (tests/editLogic.test.cjs): a press that
 * travels less than TAP_PX is a tap (opens the viewer in view mode), past it the press pans.
 * Points are COPIED on the way in: the engine keeps live pointer positions in a map, and sharing
 * one object made the start move with the pointer, so nothing ever "moved" (no pan, every drag a
 * tap — the 10-20 Edit mode bug).
 * `IGNORE` = what the canvas must leave alone: its DOM controls (the Edit tool bar, flyouts, crop
 * handles, buttons). Capturing their pointer sent their click to the canvas instead.
 */
export interface Pt { x: number; y: number }
export interface Drag { id: number; start: Pt; last: Pt; moved: boolean; primary: boolean }

export const TAP_PX = 5;

export const IGNORE = '[data-gpu-ignore], button, a, input, textarea, select, label, [role="slider"], [role="toolbar"], [role="dialog"], [role="alertdialog"], [role="menu"]';

/** Should the canvas leave a press on `target` alone? */
export const ignoredTarget = (target: { closest?: (sel: string) => unknown } | null): boolean => !!target?.closest?.(IGNORE);

export const startDrag = (id: number, p: Pt, primary: boolean): Drag => ({ id, start: { x: p.x, y: p.y }, last: { x: p.x, y: p.y }, moved: false, primary });

/** A move: null while still inside the tap slop, else the pan delta since the last move. */
export function moveDrag(d: Drag, p: Pt, tapPx = TAP_PX): { dx: number; dy: number } | null {
  if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) < tapPx) return null;
  d.moved = true;
  const dx = p.x - d.last.x, dy = p.y - d.last.y;
  d.last = { x: p.x, y: p.y };
  return { dx, dy };
}

export const isTap = (d: Drag | null, cancelled: boolean): boolean => !cancelled && !!d && d.primary && !d.moved;
