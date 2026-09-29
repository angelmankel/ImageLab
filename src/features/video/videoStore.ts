/**
 * The Video view's settings. Its own store, like Studio's: the generate view's workflow knows
 * nothing about frames or two-expert models, and the two never share state.
 */
import { create } from 'zustand';
import { uid } from '@/lib/storage';
import { defaultVideoSettings, type VideoLora, type VideoMode, type VideoSettings } from '@/lib/wanGraph';

const KEY = 'imagelab.video.v1';

/** Settings plus the start image, which is a server-side `LoadImage` reference. */
export type VideoState = VideoSettings & { startImage: string };

function load(): VideoState {
  const base = { ...defaultVideoSettings(), startImage: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...base, ...raw, models: { ...base.models, ...raw.models }, fastLoras: { ...base.fastLoras, ...raw.fastLoras }, upscale: { ...base.upscale, ...raw.upscale } };
  } catch { /* fall back to defaults */ }
  return base;
}

type Store = VideoState & {
  set: (patch: Partial<VideoState>) => void;
  setModel: (mode: VideoMode, which: 'high' | 'low', file: string) => void;
  addLora: (name: string) => void;
  updateLora: (id: string, patch: Partial<Omit<VideoLora, 'id'>>) => void;
  removeLora: (id: string) => void;
  /** Settings back to Wan's defaults; the prompt and start image stay. */
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
      const { positive, startImage, mode, loras } = get();
      patch({ ...defaultVideoSettings(), positive, startImage, mode, loras });
    },
  };
});

/** A fresh seed, the same range Studio uses. */
export const randomVideoSeed = () => Math.floor(Math.random() * 1_000_000_000_000_000);
