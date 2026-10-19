/**
 * Named video presets (`imagelab.video.presets.v1`): recipes without the prompt, the pictures or
 * the seed (`lib/videoPresets.ts`). Save the current settings under a name, apply one later on any
 * prompt, overwrite or delete it.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/storage';
import { applyPreset, presetBody, uniquePresetName, type VideoPreset } from '@/lib/videoPresets';
import { useVideo, videoSettingsOf } from './videoStore';

interface PresetState {
  presets: VideoPreset[];
  /** The preset last saved or applied, for the highlight. */
  activeId: string | null;
  save: (name: string) => void;
  overwrite: (id: string) => void;
  apply: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useVideoPresets = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      activeId: null,
      save: (name) => {
        const taken = get().presets.map((p) => p.name);
        const preset: VideoPreset = { id: uid(), name: uniquePresetName(name, taken), savedAt: Date.now(), settings: presetBody(videoSettingsOf(useVideo.getState())) };
        set((s) => ({ presets: [...s.presets, preset], activeId: preset.id }));
      },
      overwrite: (id) => set((s) => ({
        presets: s.presets.map((p) => (p.id === id ? { ...p, savedAt: Date.now(), settings: presetBody(videoSettingsOf(useVideo.getState())) } : p)),
        activeId: id,
      })),
      apply: (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (!preset) return;
        const st = useVideo.getState();
        st.set(applyPreset(videoSettingsOf(st), preset));
        set({ activeId: id });
      },
      rename: (id, name) => set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, name: uniquePresetName(name, s.presets.filter((q) => q.id !== id).map((q) => q.name)) } : p)) })),
      remove: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id), activeId: s.activeId === id ? null : s.activeId })),
    }),
    { name: 'imagelab.video.presets.v1', partialize: (s) => ({ presets: s.presets, activeId: s.activeId }) },
  ),
);
