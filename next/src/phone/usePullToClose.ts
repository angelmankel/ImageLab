/**
 * Pull-to-close (mobile pass, m-shell): drag a sheet / viewer down (or right, for a side sheet in
 * landscape) and it follows the finger; let go past ~a quarter of it or flick, and it closes.
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   usePullToClose(ref, { onClose, dir: 'down' });                 // moves ref itself
 *   usePullToClose(ref, { onClose, target: () => ref.current?.closest('.mantine-Drawer-content') });
 *
 * A touch never pulls when it starts on a text field, slider, `[data-no-swipe]` / `[data-no-pull]`,
 * or inside a scroller that can still scroll back (not at its top for 'down', not at its left for
 * 'right'): the content scrolls first, the sheet pulls after. Touch only; a mouse never drags.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { haptic } from './haptic';
import { closeDistance, pullAxis, pullCloses, pullFade, pullOffset } from './pullLogic';

const OWN = 'input, textarea, select, [contenteditable="true"], [role="slider"], .mantine-Slider-root, .mantine-RangeSlider-root, [data-no-swipe], [data-no-pull]';
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface PullOpts {
  onClose: () => void;
  dir?: 'down' | 'right';
  enabled?: boolean;
  /** The element that moves (default: the ref). */
  target?: () => HTMLElement | null | undefined;
  /** An element that fades with the pull (an overlay / backdrop). */
  fade?: () => HTMLElement | null | undefined;
}

function canScrollBack(from: Element | null, root: Element, dir: 'down' | 'right'): boolean {
  for (let el = from; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (dir === 'down' && el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(s.overflowY) && el.scrollTop > 0) return true;
    if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(s.overflowX)) {
      if (dir === 'right' && el.scrollLeft > 0) return true;
    }
    if (el === root) break;
  }
  return false;
}

export function usePullToClose(ref: RefObject<HTMLElement | null>, opts: PullOpts) {
  const latest = useRef(opts);
  latest.current = opts;
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let start: { id: number; x: number; y: number; t: number } | null = null;
    let mode: 'pull' | 'other' | null = null;
    let snapped = false;
    let el: HTMLElement | null = null;
    let fadeEl: HTMLElement | null = null;
    let size = 1;

    const dir = () => latest.current.dir ?? 'down';
    const along = (t: Touch) => (dir() === 'down' ? t.clientY - start!.y : t.clientX - start!.x);
    const across = (t: Touch) => (dir() === 'down' ? t.clientX - start!.x : t.clientY - start!.y);
    const place = (d: number, animate: boolean) => {
      if (!el) return;
      el.style.transition = animate ? `transform 220ms ${EASE}` : 'none';
      const off = pullOffset(d);
      el.style.transform = off ? (dir() === 'down' ? `translate3d(0, ${off}px, 0)` : `translate3d(${off}px, 0, 0)`) : '';
      if (fadeEl) { fadeEl.style.transition = el.style.transition.replace('transform', 'opacity'); fadeEl.style.opacity = off > 0 ? String(pullFade(off, size)) : ''; }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start = null; return; }
      const t = e.target as Element;
      if (t.closest?.(OWN) || canScrollBack(t, root, dir())) { start = null; return; }
      const touch = e.touches[0];
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, t: performance.now() };
      mode = null; snapped = false;
      el = latest.current.target?.() ?? root;
      fadeEl = latest.current.fade?.() ?? null;
      size = el ? (dir() === 'down' ? el.offsetHeight : el.offsetWidth) : 1;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = Array.from(e.changedTouches).find((x) => x.identifier === start!.id);
      if (!touch) return;
      const a = along(touch);
      if (mode == null) mode = pullAxis(a, across(touch));
      if (mode !== 'pull') { if (mode === 'other') start = null; return; }
      if (e.cancelable) e.preventDefault();
      const far = a >= closeDistance(size);
      if (far !== snapped) { snapped = far; if (far) haptic('snap'); }
      place(a, false);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const touch = Array.from(e.changedTouches).find((x) => x.identifier === start!.id);
      if (!touch) return;
      const s = start; start = null;
      if (mode !== 'pull') return;
      const a = along(touch);
      if (e.type === 'touchend' && pullCloses(a, performance.now() - s.t, size)) {
        place(size + 40, true);
        latest.current.onClose();
        const moved = el; const faded = fadeEl;
        window.setTimeout(() => {
          if (moved) { moved.style.transition = ''; moved.style.transform = ''; }
          if (faded) { faded.style.transition = ''; faded.style.opacity = ''; }
        }, 400);
      } else place(0, true);
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [ref, enabled]);
}
