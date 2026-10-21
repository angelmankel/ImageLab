/**
 * A very light buzz for touch feedback (mobile pass, m-shell). Only on touch devices, only where
 * the browser has `navigator.vibrate` (Android Chrome; iOS Safari has none, so it is silent there).
 * Off when the theme's motion is off or the OS asks for reduced motion.
 *
 *   haptic()          // 'tick' — a tap that changed something (toggle, pick)
 *   haptic('hold')    // a long-press landed (menu opens, mode switched)
 *   haptic('snap')    // a drag crossed its threshold (pull-to-close will close, swipe commits)
 */
export type HapticKind = 'tick' | 'hold' | 'snap' | 'warn';

const MS: Record<HapticKind, number | number[]> = { tick: 6, hold: 12, snap: 8, warn: [10, 40, 10] };

function allowed(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function haptic(kind: HapticKind = 'tick'): void {
  if (!allowed()) return;
  try { navigator.vibrate(MS[kind]); } catch { /* blocked until the first user gesture */ }
}
