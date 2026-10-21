/**
 * App-wide UI feedback, mounted once in App (items 26 + 44):
 *   - the H key flips hints on / off (listed in the shortcuts card);
 *   - UI sounds by delegation, so every button in every screen gets them without an edit: hover
 *     onto a new control, a press (`pressAction`: delete / copy / favourite by the control's name,
 *     toggle on / off for switches, checkboxes and pressed-state buttons, tab, else click).
 *     `data-sound="<action>|none"` picks one; `data-no-sound` on an element (or an ancestor) opts
 *     it out. The sounds themselves are synthesised live in the chosen theme, or Donny's pack
 *     (`~/app/sounds`, installed here);
 *   - a toast sounds by its colour: red = error, yellow / orange = warning, green / teal = success;
 *   - the sounds nobody calls (all done, download done, window open / close, drops): `soundWatchers`;
 *   - native `title` tooltips are drawn as ours, never two at once (TitleTips, FIXLIST-2 item 20).
 */
import { useEffect } from 'react';
import { notificationsStore } from '@mantine/notifications';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { playSound } from '@/lib/sounds';
import { installSoundEngine } from '~/app/sounds/soundEngine';
import { installSoundWatchers } from '~/app/sounds/soundWatchers';
import { pressAction } from '~/app/sounds/soundActions';
import { useHints } from './hints';
import { TitleTips } from './TitleTips';

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
    installSoundEngine();
    return installSoundWatchers();
  }, []);

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
      const action = pressAction({
        dataSound: el.closest<HTMLElement>('[data-sound]')?.dataset.sound,
        label: el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent ?? '').slice(0, 40),
        role: el.getAttribute('role'),
        toggleTo: toggleTarget(el),
        tag: el.tagName,
      });
      if (action) playSound(action);
    };
    // Toasts: one sound per new toast id, by colour.
    const seen = new Set(notificationsStore.getState().notifications.map((n) => String(n.id)));
    const unsub = notificationsStore.subscribe((st) => {
      for (const n of [...st.notifications, ...st.queue]) {
        const id = String(n.id);
        if (seen.has(id)) continue;
        seen.add(id);
        const c = String(n.color ?? '');
        if (c === 'red') playSound('error');
        else if (c === 'yellow' || c === 'orange') playSound('warning');
        else if (c === 'green' || c === 'teal') playSound('success');
      }
      if (seen.size > 200) { seen.clear(); for (const n of [...st.notifications, ...st.queue]) seen.add(String(n.id)); }
    });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true, capture: true });
    return () => {
      unsub();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down, { capture: true });
    };
  }, []);
  return <TitleTips />;
}
