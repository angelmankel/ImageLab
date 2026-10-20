/**
 * Browser fullscreen for the whole page (fix list 19 / 29): the top bar's button and the F key
 * (app-wide, never while typing, never with Ctrl / ⌘ / Alt so Ctrl+F stays the browser's find).
 */
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';

export const canFullscreen = (): boolean => typeof document !== 'undefined' && !!document.fullscreenEnabled;

export function toggleFullscreen(): void {
  if (!canFullscreen()) return;
  const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  p?.catch(() => { /* refused (no user gesture / policy) */ });
}

/** Mount once (App): F toggles fullscreen. */
export function useFullscreenHotkey(): void {
  useShortcut(['f', 'shift+F'], (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;
    e.preventDefault();
    toggleFullscreen();
  }, { priority: ShortcutPriority.Global });
}
