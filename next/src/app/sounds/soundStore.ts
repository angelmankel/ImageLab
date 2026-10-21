/**
 * Settings → Sounds (FIXLIST-2 "New UI sounds" + "synth sounds"): the theme (Soft / Glass / Pop =
 * synthesised, Pack = samples), the sound and volume per action, and whether the theme's motion
 * setting quiets the interface sounds. Stored in this browser (`imagelab.next.sounds.v1`, store
 * version 2: a pack-era save is migrated by `migratePicksV1`). Mute and the master volume stay in
 * `@/lib/sounds` (shared with the classic app and the top bar's MuteToggle).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  clamp01, DEFAULT_THEME, defaultPicks, isThemeId, mergePicks, migratePicksV1,
  type ActionPicks, type SoundAction, type SoundThemeId,
} from './soundActions';

interface SoundPicksState {
  theme: SoundThemeId;
  picks: ActionPicks;
  /** Motion off (or reduced) quiets the interface sounds; subtle quiets the hover. */
  followMotion: boolean;
  setTheme: (theme: SoundThemeId) => void;
  setSound: (action: SoundAction, sound: string | null) => void;
  setVolume: (action: SoundAction, volume: number) => void;
  setFollowMotion: (on: boolean) => void;
  reset: () => void;
}

export const useSoundPicks = create<SoundPicksState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      picks: defaultPicks(),
      followMotion: true,
      setTheme: (theme) => set({ theme }),
      setSound: (action, sound) => set((s) => ({ picks: { ...s.picks, [action]: { ...s.picks[action], sound } } })),
      setVolume: (action, volume) => set((s) => ({ picks: { ...s.picks, [action]: { ...s.picks[action], volume: clamp01(volume) } } })),
      setFollowMotion: (followMotion) => set({ followMotion }),
      reset: () => set({ theme: DEFAULT_THEME, picks: defaultPicks(), followMotion: true }),
    }),
    {
      name: 'imagelab.next.sounds.v1',
      version: 2,
      partialize: (s) => ({ theme: s.theme, picks: s.picks, followMotion: s.followMotion }),
      migrate: (saved, version) => {
        const p = (saved ?? {}) as Record<string, unknown>;
        return version < 2 ? { ...p, picks: migratePicksV1(p.picks), theme: DEFAULT_THEME } : p;
      },
      merge: (saved, cur) => {
        const p = (saved ?? {}) as Partial<SoundPicksState>;
        return { ...cur, theme: isThemeId(p.theme) ? p.theme : DEFAULT_THEME, picks: mergePicks(p.picks), followMotion: p.followMotion !== false };
      },
    },
  ),
);
