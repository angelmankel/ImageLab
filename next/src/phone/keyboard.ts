/**
 * On-screen keyboard handling for the phone (mobile pass, m-shell). Mounted once by PhoneShell
 * (`<PhoneEffects />`), so every phone screen gets it:
 *
 *  - `--il-kb` on <html>: the keyboard's height in CSS px (0px when closed), and `data-kb` while it
 *    is open. Bottom bars that hold a text field add it: `bottom: calc(8px + var(--il-kb, 0px))`.
 *    The dock hides itself while the keyboard is open (`html[data-kb] .il-hide-on-kb`).
 *  - The focused field is never under the keyboard: when it opens (or focus moves) the nearest
 *    scroller is nudged so the field sits above it with a small margin.
 *  - `useKeyboardOpen()` for components that change layout while typing.
 */
import { useSyncExternalStore } from 'react';
import { toCssPx } from '~/theme/uiScale';
import { keyboardInset, revealDelta } from './keyboardLogic';

let inset = 0;
const listeners = new Set<() => void>();

function isField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const t = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden'].includes(t);
}

function scroller(from: HTMLElement): HTMLElement | null {
  for (let el = from.parentElement; el; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
}

/** Bring the focused field above the keyboard. */
export function revealFocused(): void {
  const f = document.activeElement;
  if (!isField(f)) return;
  const vv = window.visualViewport;
  const bandTop = vv ? vv.offsetTop : 0;
  const bandBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const r = f.getBoundingClientRect();
  const d = revealDelta(r.top, r.bottom, bandTop, bandBottom);
  if (!d) return;
  const s = scroller(f);
  if (s) s.scrollBy({ top: toCssPx(d), behavior: 'smooth' });
  else f.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function measure() {
  const vv = window.visualViewport;
  if (!vv) return;
  const next = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
  if (next === inset) return;
  const opened = next > inset;
  inset = next;
  const root = document.documentElement;
  root.style.setProperty('--il-kb', `${toCssPx(inset)}px`);
  if (inset) root.setAttribute('data-kb', ''); else root.removeAttribute('data-kb');
  for (const l of listeners) l();
  if (opened) requestAnimationFrame(revealFocused);
}

let started = false;
/** Start listening (idempotent). PhoneEffects calls it. */
export function startKeyboardWatch(): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;
  document.documentElement.style.setProperty('--il-kb', '0px');
  const vv = window.visualViewport;
  const onFocus = (e: FocusEvent) => { if (isField(e.target as Element)) window.setTimeout(revealFocused, 320); };
  vv?.addEventListener('resize', measure);
  vv?.addEventListener('scroll', measure);
  document.addEventListener('focusin', onFocus);
  return () => {
    started = false;
    vv?.removeEventListener('resize', measure);
    vv?.removeEventListener('scroll', measure);
    document.removeEventListener('focusin', onFocus);
  };
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The keyboard's height in window px (0 = closed). */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, () => inset, () => 0);
}
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, () => inset > 0, () => false);
}
