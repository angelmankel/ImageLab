/**
 * Long-press (touch or mouse held ~450 ms without moving) → `onLongPress`. Spread the result on
 * a tile; a press that moves > 10px or lifts early is left to the tile's own tap. Used as the
 * phone's way to "drag" a picture: it opens the Send-to sheet (`openSendTo`).
 */
import { useCallback, useRef, type PointerEvent } from 'react';

const HOLD_MS = 450;
const SLOP = 10;

export function useLongPress(onLongPress: () => void, opts: { disabled?: boolean } = {}) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = useCallback(() => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } start.current = null; }, []);
  const onPointerDown = useCallback((e: PointerEvent) => {
    if (opts.disabled || e.button !== 0) return;
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => { timer.current = null; fired.current = true; onLongPress(); }, HOLD_MS);
  }, [onLongPress, opts.disabled]);
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > SLOP || Math.abs(e.clientY - start.current.y) > SLOP) clear();
  }, [clear]);
  /** A click right after a long-press is the same gesture: swallow it. */
  const onClickCapture = useCallback((e: { preventDefault: () => void; stopPropagation: () => void }) => { if (fired.current) { fired.current = false; e.preventDefault(); e.stopPropagation(); } }, []);
  const onContextMenu = useCallback((e: { preventDefault: () => void }) => { if (fired.current) e.preventDefault(); }, []);
  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, onPointerLeave: clear, onClickCapture, onContextMenu };
}
