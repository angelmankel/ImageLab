/**
 * Fix list 2 #21: the app's own cursors (drawings in `cursorArt.ts`). On by default; Settings →
 * Themes → "App cursors" turns them off (remembered in this browser). When on, <html> gets the
 * `il-cursors` class and one CSS variable per cursor (`--il-cur-zoom-in` …); `cursors.css` maps
 * every place the app asks for that native cursor (inline styles, the classic UI's Tailwind
 * classes, buttons and links) onto it. Text, default and none stay native. 1× and 2× images, so
 * it is crisp on HiDPI and at the 110% UI size.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CURSOR_NAMES, cursorCss } from './cursorArt';
import './cursors.css';

interface CursorPrefs { on: boolean; setOn: (on: boolean) => void }

export const useCursors = create<CursorPrefs>()(persist((set) => ({
  on: true,
  setOn: (on) => set({ on }),
}), { name: 'imagelab.next.cursors.v1' }));

let filled = false;

/** Put the variables on <html> once, then switch the class. */
export function applyCursors(on: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (on && !filled) {
    const probe = cursorCss('move');
    const imageSet = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('cursor', probe);
    for (const n of CURSOR_NAMES) root.style.setProperty(`--il-cur-${n}`, cursorCss(n, 1, imageSet));
    filled = true;
  }
  root.classList.toggle('il-cursors', on);
}

/** Mounted once in App. */
export function CursorEffects(): null {
  const on = useCursors((s) => s.on);
  useEffect(() => { applyCursors(on); }, [on]);
  return null;
}
