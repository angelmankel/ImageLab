/**
 * The player's remembered choices (loop · mute · volume · speed) in localStorage under
 * `imagelab.next.player.v1`. Reads and writes are wrapped: a private window or a full store
 * just means the defaults. Selectors return primitives only.
 */
import { create } from 'zustand';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type PlayerPrefs } from './playerLogic';

function read(): PlayerPrefs {
  try { return parsePrefs(localStorage.getItem(PREFS_KEY)); } catch { return { ...DEFAULT_PREFS }; }
}

function write(p: PlayerPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage refused: the choice lasts this session */ }
}

interface PrefsStore extends PlayerPrefs {
  set: (patch: Partial<PlayerPrefs>) => void;
}

export const usePlayerPrefs = create<PrefsStore>((set, get) => ({
  ...read(),
  set: (patch) => {
    const s = get();
    const next: PlayerPrefs = { loop: s.loop, muted: s.muted, volume: s.volume, speed: s.speed, ...patch };
    write(next);
    set(patch);
  },
}));
