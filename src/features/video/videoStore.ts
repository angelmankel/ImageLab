/**
 * The Video view's settings. Its own store, like Studio's: the generate view's workflow knows
 * nothing about frames or two-expert models, and the two never share state.
 *
 * Saved settings go through `loadVideoSettings`, so a browser that saved before a field existed
 * gets that field's default and the graph it always built.
 */
import { create } from 'zustand';
import { uid } from '@/lib/storage';
import { defaultVideoSettings, loadVideoSettings, type VideoLora, type VideoMode, type VideoSettings } from '@/lib/wanGraph';

const KEY = 'imagelab.video.v1';

/** Settings plus the start image, which is a server-side `LoadImage` reference. */
export type VideoState = VideoSettings & { startImage: string };

function load(): VideoState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    const startImage = raw && typeof raw === 'object' && typeof raw.startImage === 'string' ? raw.startImage : '';
    return { ...loadVideoSettings(raw), startImage };
  } catch { /* fall back to defaults */ }
  return { ...defaultVideoSettings(), startImage: '' };
}

type Store = VideoState & {
  set: (patch: Partial<VideoState>) => void;
  setModel: (mode: VideoMode, which: 'high' | 'low', file: string) => void;
  addLora: (name: string) => void;
  updateLora: (id: string, patch: Partial<Omit<VideoLora, 'id'>>) => void;
  removeLora: (id: string) => void;
  /** Settings back to Wan's defaults; the prompt, start image, LoRAs and speed-LoRA marks stay. */
  resetSettings: () => void;
};

const settingsOf = (s: Store): VideoState => {
  const { set: _s, setModel: _m, addLora: _a, updateLora: _u, removeLora: _r, resetSettings: _x, ...rest } = s;
  return rest;
};

export const useVideo = create<Store>((set, get) => {
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(settingsOf(get()))); } catch { /* storage full or blocked */ }
  };
  const patch = (p: Partial<VideoState>) => { set(p); save(); };
  return {
    ...load(),
    set: patch,
    setModel: (mode, which, file) => patch({ models: { ...get().models, [mode]: { ...get().models[mode], [which]: file } } }),
    // Wan 2.2 LoRAs ship as a high/low pair, so a name that says which starts on that expert.
    addLora: (name) => patch({ loras: [...get().loras, {
      id: uid(), name, strength: 1, on: true,
      expert: /high/i.test(name) ? 'high' : /low/i.test(name) ? 'low' : 'both',
    }] }),
    updateLora: (id, p) => patch({ loras: get().loras.map((l) => (l.id === id ? { ...l, ...p } : l)) }),
    removeLora: (id) => patch({ loras: get().loras.filter((l) => l.id !== id) }),
    resetSettings: () => {
      const { positive, startImage, endImage, mode, loras, speedInside } = get();
      patch({ ...defaultVideoSettings(), positive, startImage, endImage, mode, loras, speedInside });
    },
  };
});

/** The settings alone (no start image), as the graph and the presets want them. */
export const videoSettingsOf = (s: VideoState): VideoSettings => {
  const { startImage: _i, ...rest } = s;
  return rest;
};

/** A fresh seed, the same range Studio uses. */
export const randomVideoSeed = () => Math.floor(Math.random() * 1_000_000_000_000_000);
