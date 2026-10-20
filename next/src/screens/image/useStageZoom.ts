/**
 * Pan and zoom for the stage picture (desktop, rule 1: nothing over the picture, no chrome):
 *   wheel zooms about the cursor; a trackpad pinch (wheel + ctrlKey) too, on its own steeper curve;
 *   two fingers pinch 1:1 with their distance about the midpoint; one pointer (mouse or finger)
 *   drags to pan when zoomed; a press that neither moved nor pinched is a tap (opens the viewer).
 * The toolbar's Fit · Zoom in · Zoom out call `fit` / `zoomIn` / `zoomOut` on the same state.
 * The maths is `stageZoom.ts`. The wheel listener is native and non-passive (React's onWheel is
 * passive, so its preventDefault could not stop the browser zooming the page on ctrl+wheel).
 * (The main app's `usePanZoom` has no imperative zoom for toolbar buttons, so the stage keeps this.)
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { FIT, ZOOM_STEP, panBy, pinchOf, pinchTo, startPinch, trackpadFactor, wheelFactor, zoomAbout, type PinchStart, type Pt, type ZoomState } from './stageZoom';

const TAP_PX = 5;

export function useStageZoom(ref: RefObject<HTMLElement | null>, resetKey: unknown, onTap?: () => void, enabled = true) {
  const [state, setState] = useState<ZoomState>(FIT);
  const stateRef = useRef(state); stateRef.current = state;
  /** Every active pointer by id (mouse button 0, pen, every touch). */
  const pointers = useRef(new Map<number, Pt>());
  /** The one pointer that pans; `moved` once it travelled past TAP_PX (then its release is no tap). */
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<PinchStart | null>(null);
  /** A second finger joined this gesture: releasing is never a tap. */
  const pinched = useRef(false);
  useEffect(() => { setState(FIT); }, [resetKey]);

  /** A client point relative to the picture's centre. */
  const centre = useCallback((p: Pt): Pt => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: p.x - (r.left + r.width / 2), y: p.y - (r.top + r.height / 2) };
  }, [ref]);
  const pinchNow = useCallback(() => {
    const [a, b] = [...pointers.current.values()];
    return pinchOf(centre(a), centre(b));
  }, [centre]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = centre({ x: e.clientX, y: e.clientY });
      const factor = e.ctrlKey ? trackpadFactor(e.deltaY) : wheelFactor(e.deltaY);
      setState((s) => zoomAbout(s, factor, p.x, p.y));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, enabled, centre]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const map = pointers.current;
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A mouse press on a draggable picture (fit size) may become a native drag (~/dnd): capturing
    // the pointer would swallow it. Its dragstart cancels the pointer, so it is never a tap.
    const nativeDrag = e.pointerType === 'mouse' && (e.target as HTMLElement).draggable === true;
    if (!nativeDrag) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (map.size === 1) {
      pinched.current = false;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    } else if (map.size === 2) {
      pinched.current = true;
      drag.current = null;
      pinch.current = startPinch(stateRef.current, pinchNow());
    }
  }, [pinchNow]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const map = pointers.current;
    const pt = map.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX; pt.y = e.clientY;
    if (map.size === 2 && pinch.current) {
      const start = pinch.current;
      setState(pinchTo(start, pinchNow()));
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_PX) return;
    d.moved = true; d.x = e.clientX; d.y = e.clientY;
    setState((s) => panBy(s, dx, dy));
  }, [pinchNow]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const map = pointers.current;
    if (!map.delete(e.pointerId)) return;
    if (map.size === 1) {
      // The pinch ended with one finger still down: it goes on as a pan, never a tap.
      const [id, p] = [...map.entries()][0];
      pinch.current = null;
      drag.current = { id, x: p.x, y: p.y, moved: true };
      return;
    }
    if (map.size > 1) {
      // A third finger left: the two that remain start a fresh pinch.
      if (map.size === 2) pinch.current = startPinch(stateRef.current, pinchNow());
      return;
    }
    const d = drag.current;
    drag.current = null; pinch.current = null;
    const tap = e.type !== 'pointercancel' && !pinched.current && !!d && d.id === e.pointerId && !d.moved;
    pinched.current = false;
    if (tap) onTap?.();
  }, [onTap, pinchNow]);

  return {
    state,
    fit: () => setState(FIT),
    zoomIn: () => setState((s) => zoomAbout(s, ZOOM_STEP)),
    zoomOut: () => setState((s) => zoomAbout(s, 1 / ZOOM_STEP)),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
