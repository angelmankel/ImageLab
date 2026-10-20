/**
 * Where the app is. A hash router (`#/`, `#/library`, `#/models`, `#/comfy`, `#/settings`) so
 * the page works from any path under nginx try_files and the phone's back button works.
 *   step     → the active step's screen (Image / Upscale / Video …)  — the only place that generates
 *   library  → History & collections
 *   models   → the CivitAI browser
 *   comfy    → ComfyUI (servers, saved workflows, embedded UI, queue + log)
 *   settings → app settings
 */
import { create } from 'zustand';

export type Screen = 'step' | 'library' | 'models' | 'comfy' | 'settings';

const SCREENS: Screen[] = ['step', 'library', 'models', 'comfy', 'settings'];

export function screenOfHash(hash: string): Screen {
  const seg = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (SCREENS as string[]).includes(seg) ? (seg as Screen) : 'step';
}
export function hashOfScreen(s: Screen): string { return s === 'step' ? '#/' : `#/${s}`; }

interface RouteState {
  screen: Screen;
  go: (s: Screen) => void;
  back: () => void;
}

export const useRoute = create<RouteState>((set) => ({
  screen: typeof location === 'undefined' ? 'step' : screenOfHash(location.hash),
  go: (s) => {
    if (typeof location !== 'undefined' && location.hash !== hashOfScreen(s)) location.hash = hashOfScreen(s);
    set({ screen: s });
  },
  back: () => {
    if (typeof history !== 'undefined' && history.length > 1) history.back();
    else useRoute.getState().go('step');
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => useRoute.setState({ screen: screenOfHash(location.hash) }));
}
