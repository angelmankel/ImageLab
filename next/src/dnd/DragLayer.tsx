/**
 * The app-wide drag layer (fix list 42), mounted once in App. Watches the window for drags that
 * come from OUTSIDE (a file from the desktop, a picture from another tab) and marks them in
 * `dragStore`, so every target lights up before the pointer reaches it; stops the browser from
 * opening a dropped file as a page when it lands outside a target; clears the drag state on
 * drop / dragend / the pointer leaving the window. Renders nothing.
 */
import { useEffect } from 'react';
import { useDrag } from './dragStore';
import { mayCarryImage } from './payload';

export function DragLayer() {
  const begin = useDrag((s) => s.begin);
  const end = useDrag((s) => s.end);
  useEffect(() => {
    let depth = 0;
    let timer: number | null = null;
    const arm = () => { if (timer) window.clearTimeout(timer); timer = window.setTimeout(() => { depth = 0; end(); }, 1500); };
    const enter = (e: globalThis.DragEvent) => {
      if (!mayCarryImage(e.dataTransfer?.types)) return;
      depth += 1;
      if (!useDrag.getState().dragging) begin(null, true);
      arm();
    };
    const over = (e: globalThis.DragEvent) => {
      if (!mayCarryImage(e.dataTransfer?.types)) return;
      // Nothing under the pointer took it: say "no" so a file never opens as a page, keep the drag alive.
      if (!e.defaultPrevented) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'; }
      arm();
    };
    const leave = (e: globalThis.DragEvent) => {
      if (!mayCarryImage(e.dataTransfer?.types)) return;
      depth = Math.max(0, depth - 1);
      // Left the window (no element under the pointer any more).
      if (depth === 0 || !e.relatedTarget) { depth = 0; end(); }
    };
    const drop = (e: globalThis.DragEvent) => { if (!e.defaultPrevented) e.preventDefault(); depth = 0; end(); };
    const dragend = () => { depth = 0; end(); };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', dragend);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', dragend);
      if (timer) window.clearTimeout(timer);
    };
  }, [begin, end]);
  return null;
}
