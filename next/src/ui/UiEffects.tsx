/**
 * App-wide UI feedback, mounted once in App (items 26 + 44):
 *   - the H key flips hints on / off (listed in the shortcuts card);
 *   - UI sounds by delegation, so every button in every screen gets them without an edit: a
 *     whisper on mouse hover onto a new control, a tick on press, the toggle sound for switches,
 *     checkboxes and pressed-state buttons (direction = the new state). `data-no-sound` on an
 *     element (or an ancestor) opts it out.
 * Renders nothing.
 */
import { useEffect } from 'react';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { playSound } from '@/lib/sounds';
import { useHints } from './hints';

const CONTROL = 'button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], a[href], input[type="checkbox"], input[type="radio"], summary';

function controlOf(t: EventTarget | null): HTMLElement | null {
  const el = t instanceof Element ? t.closest<HTMLElement>(CONTROL) : null;
  if (!el || el.closest('[data-no-sound]')) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  return el;
}

/** A control whose press flips a state: report the state it flips TO, else undefined. */
function toggleTarget(el: HTMLElement): boolean | undefined {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) return !el.checked;
  const role = el.getAttribute('role');
  const checked = el.getAttribute('aria-checked');
  if ((role === 'switch' || role === 'checkbox') && checked != null) return checked !== 'true';
  const pressed = el.getAttribute('aria-pressed');
  if (pressed === 'true' || pressed === 'false') return pressed !== 'true';
  // A Mantine Switch: the visible track is a label around a hidden checkbox.
  if (el instanceof HTMLLabelElement) {
    const box = (el.htmlFor ? document.getElementById(el.htmlFor) : el.querySelector('input')) as HTMLInputElement | null;
    if (box instanceof HTMLInputElement && box.type === 'checkbox') return !box.checked;
  }
  return undefined;
}

export function UiEffects() {
  useShortcut(['h', 'H'], (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    e.preventDefault();
    useHints.getState().toggle();
    playSound('toggle', { on: useHints.getState().enabled });
  }, { priority: ShortcutPriority.Global });

  useEffect(() => {
    let lastHover: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = controlOf(e.target);
      if (el === lastHover) return;
      lastHover = el;
      if (el) playSound('hover');
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = controlOf(e.target) ?? (e.target instanceof Element ? e.target.closest<HTMLElement>('label') : null);
      if (!el || el.closest('[data-no-sound]')) return;
      const to = toggleTarget(el);
      if (to !== undefined) playSound('toggle', { on: to });
      else if (el.tagName !== 'LABEL') playSound('click');
    };
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down, { capture: true });
    };
  }, []);
  return null;
}
