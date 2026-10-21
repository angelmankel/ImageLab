/**
 * Settings → Sounds (FIXLIST-2 "New UI sounds"): the sound and volume per action, and whether the
 * theme's motion setting quiets the interface sounds. Stored in this browser
 * (`imagelab.next.sounds.v1`). Mute and the master volume stay in `@/lib/sounds` (shared with the
 * classic app and the top bar's MuteToggle).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clamp01, defaultPicks, mergePicks, type ActionPicks, type SoundAction } from './soundActions';

interface SoundPicksState {
  picks: ActionPicks;
  /** Motion off (or reduced) quiets the interface sounds; subtle quiets the hover. */
  followMotion: boolean;
  setSound: (action: SoundAction, sound: string | null) => void;
  setVolume: (action: SoundAction, volume: number) => void;
  setFollowMotion: (on: boolean) => void;
  reset: () => void;
}

export const useSoundPicks = create<SoundPicksState>()(
  persist(
    (set) => ({
      picks: defaultPicks(),
      followMotion: true,
      setSound: (action, sound) => set((s) => ({ picks: { ...s.picks, [action]: { ...s.picks[action], sound } } })),
      setVolume: (action, volume) => set((s) => ({ picks: { ...s.picks, [action]: { ...s.picks[action], volume: clamp01(volume) } } })),
      setFollowMotion: (followMotion) => set({ followMotion }),
      reset: () => set({ picks: defaultPicks(), followMotion: true }),
    }),
    {
      name: 'imagelab.next.sounds.v1',
      partialize: (s) => ({ picks: s.picks, followMotion: s.followMotion }),
      merge: (saved, cur) => {
        const p = (saved ?? {}) as Partial<SoundPicksState>;
        return { ...cur, picks: mergePicks(p.picks), followMotion: p.followMotion !== false };
      },
    },
  ),
);
