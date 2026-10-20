/**
 * Pan and zoom for the stage picture: wheel zooms about the cursor, a drag pans when zoomed, the
 * toolbar's Fit · Zoom in · Zoom out call `fit` / `zoomIn` / `zoomOut`, and a press that did not
 * drag is a tap (opens the viewer). The maths is `stageZoom.ts`. (The main app's `usePanZoom` has
 * no imperative zoom for toolbar buttons, so the stage keeps this small one.)
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { FIT, ZOOM_STEP, panBy, wheelFactor, zoomAbout, type ZoomState } from './stageZoom';

const TAP_PX = 5;

export function useStageZoom(ref: RefObject<HTMLElement | null>, resetKey: unknown, onTap?: () => void) {
  const [state, setState] = useState<ZoomState>(FIT);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => { setState(FIT); }, [resetKey]);

  const centre = useCallback((e: { clientX: number; clientY: number }) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return { px: 0, py: 0 };
    return { px: e.clientX - (r.left + r.width / 2), py: e.clientY - (r.top + r.height / 2) };
  }, [ref]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { px, py } = centre(e);
    setState((s) => zoomAbout(s, wheelFactor(e.deltaY), px, py));
  }, [centre]);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_PX) return;
    d.moved = true; d.x = e.clientX; d.y = e.clientY;
    setState((s) => panBy(s, dx, dy));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) onTap?.();
  }, [onTap]);

  return {
    state,
    fit: () => setState(FIT),
    zoomIn: () => setState((s) => zoomAbout(s, ZOOM_STEP)),
    zoomOut: () => setState((s) => zoomAbout(s, 1 / ZOOM_STEP)),
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { drag.current = null; } },
  };
}
