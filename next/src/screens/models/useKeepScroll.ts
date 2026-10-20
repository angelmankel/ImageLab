/**
 * Keeps a scroll container's position across unmounts (Donny, 10-20: "always persist scroll
 * position in model browsers/viewers"): the models grid / phone list, the detail panel, the
 * viewer's metadata column and thumb strip. `useKeepScroll(key)` returns a ref callback; the
 * position lives in a module-level Map (memory only — a reload starts at the top).
 *
 * Restore happens before paint; lists load lazily, so while the saved spot is out of reach the
 * hook re-applies it as content arrives (DOM additions), until it is reached, the person scrolls
 * themselves (wheel / touch / pointer / key), or RESTORE_MS passes. Saving is a passive,
 * rAF-throttled scroll listener, plus a last read on unmount. A `null` key does nothing.
 */
import { useLayoutEffect, useRef, useState } from 'react';

export interface ScrollPos { top: number; left: number }

const kept = new Map<string, ScrollPos>();
const ZERO: ScrollPos = { top: 0, left: 0 };
const RESTORE_MS = 10_000;
const INTENT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** The models grid's key: a new filter set (source · kind · search) is a new list with its own spot. */
export function modelsListKey(source: string, kind: string | null | undefined, query: string, phone = false): string {
  return `${phone ? 'phone:' : ''}models:${source}:${kind ?? 'all'}:${query.trim()}`;
}

/** True when the saved spot lies within what the container can scroll to right now. */
export function reachable(want: ScrollPos, max: ScrollPos): boolean {
  return want.top <= max.top + 1 && want.left <= max.left + 1;
}

/** The saved position for a key (undefined before the first scroll). */
export function keptScroll(key: string | null | undefined): ScrollPos | undefined {
  return key ? kept.get(key) : undefined;
}

export function useKeepScroll(key: string | null): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const unmounting = useRef(false);

  // Declared first, so on unmount its cleanup runs before the one below and tells it so.
  useLayoutEffect(() => { unmounting.current = false; return () => { unmounting.current = true; }; }, []);

  useLayoutEffect(() => {
    if (!el || !key) return;
    const want = kept.get(key) ?? ZERO;
    let pending = true;
    let frame = 0;
    let timer = 0;
    let mo: MutationObserver | null = null;

    const save = () => { frame = 0; kept.set(key, { top: el.scrollTop, left: el.scrollLeft }); };
    const stop = () => {
      if (!pending) return;
      pending = false;
      mo?.disconnect();
      window.clearTimeout(timer);
      for (const t of INTENT) el.removeEventListener(t, stop);
    };
    const apply = () => {
      if (!pending) return;
      el.scrollTop = want.top;
      el.scrollLeft = want.left;
      if (reachable(want, { top: el.scrollHeight - el.clientHeight, left: el.scrollWidth - el.clientWidth })) stop();
    };
    const onScroll = () => { if (!pending && !frame) frame = requestAnimationFrame(save); };

    apply();
    if (pending) {
      mo = new MutationObserver(apply);
      mo.observe(el, { childList: true, subtree: true });
      timer = window.setTimeout(stop, RESTORE_MS);
      for (const t of INTENT) el.addEventListener(t, stop, { passive: true });
    }
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      // Unmount: the DOM is still intact, so a scroll the rAF has not saved yet is read now. A key
      // change runs this after the new list is in the DOM: drop the old key's unsaved frame (at
      // most ~16ms of scroll) rather than read the new list's position into it.
      if (frame) { cancelAnimationFrame(frame); if (unmounting.current && !pending) save(); }
      frame = 0;
      stop();
      el.removeEventListener('scroll', onScroll);
    };
  }, [el, key]);

  return setEl;
}
