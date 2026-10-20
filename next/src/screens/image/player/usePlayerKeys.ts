/**
 * The desktop player's keys, through the app's shortcut registry (nothing fires in a text box):
 * Space play / pause · ← → one second · Shift+← → one frame · M mute · L loop · F fullscreen.
 * Registered a notch above the stage's own ←/→ (which page results for pictures) so a shown clip
 * seeks instead. Ctrl / ⌘ / Alt chords pass through (browser find, Ctrl+Enter for Generate…),
 * and Space on a focused button is that button's.
 */
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { SEEK_STEP } from './playerLogic';

export const PLAYER_KEY_PRIORITY = ShortcutPriority.Panel + 20;

export interface PlayerKeyActions {
  playPause: () => void;
  seekBy: (seconds: number) => void;
  step: (dir: 1 | -1) => void;
  mute: () => void;
  loop: () => void;
  fullscreen: () => void;
}

export function usePlayerKeys(a: PlayerKeyActions, enabled: boolean, when?: () => boolean) {
  const active = () => enabled && (when ? when() : true);
  const chord = (e: KeyboardEvent) => e.ctrlKey || e.metaKey || e.altKey;

  useShortcut('space', (e) => {
    if (chord(e)) return false;
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === 'BUTTON') return false;
    e.preventDefault(); a.playPause();
  }, { priority: PLAYER_KEY_PRIORITY, when: active });
  useShortcut(['ArrowLeft', 'ArrowRight'], (e) => {
    if (chord(e)) return false;
    e.preventDefault(); a.seekBy(e.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP);
  }, { priority: PLAYER_KEY_PRIORITY, when: active });
  useShortcut(['shift+ArrowLeft', 'shift+ArrowRight'], (e) => {
    if (chord(e)) return false;
    e.preventDefault(); a.step(e.key === 'ArrowLeft' ? -1 : 1);
  }, { priority: PLAYER_KEY_PRIORITY, when: active });
  useShortcut('m', (e) => { if (chord(e)) return false; e.preventDefault(); a.mute(); }, { priority: PLAYER_KEY_PRIORITY, when: active });
  useShortcut('l', (e) => { if (chord(e)) return false; e.preventDefault(); a.loop(); }, { priority: PLAYER_KEY_PRIORITY, when: active });
  useShortcut('f', (e) => { if (chord(e)) return false; e.preventDefault(); a.fullscreen(); }, { priority: PLAYER_KEY_PRIORITY, when: active });
}
