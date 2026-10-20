/**
 * Keys while Settings is open: Esc clears the search (and leaves the box); Ctrl/⌘+F or "/"
 * focuses it — unless a text box has the focus, where "/" is a character and Ctrl+F is the
 * browser's. Mounted by the screens, so it lives only while the page does.
 */
import { useEffect, type RefObject } from 'react';
import { useSettingsUi } from './settingsStore';

function typingIn(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export function useSettingsKeys(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = input.current;
      if (e.key === 'Escape') {
        if (e.target !== box && typingIn(e.target)) return;
        if (useSettingsUi.getState().query) { useSettingsUi.getState().setQuery(''); box?.blur(); }
        return;
      }
      if (typingIn(e.target)) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f')) {
        if (!box) return;
        e.preventDefault();
        box.focus();
        box.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input]);
}
