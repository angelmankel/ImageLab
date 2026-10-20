/**
 * ControlNet entries for the Model tab (rule 4: "ControlNet entries carry their image +
 * preprocessor + strength"). The main app's WorkflowState has no ControlNet list of its own (only
 * the inpaint one), so the entries live here until the graph builder takes them; the picture is
 * kept in memory only (a data URL would not fit localStorage).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const PREPROCESSORS = ['none', 'canny', 'depth', 'openpose', 'lineart', 'softedge', 'scribble', 'tile'] as const;
export type Preprocessor = typeof PREPROCESSORS[number];

export interface ControlNetImage { dataUrl: string; name: string; width: number; height: number }

export interface ControlNetEntry {
  id: string;
  /** File name as `ServerInfo.controlnets` lists it. */
  name: string;
  on: boolean;
  strength: number;
  preprocessor: Preprocessor;
  image: ControlNetImage | null;
}

interface ControlNetState {
  entries: ControlNetEntry[];
  add: (name: string) => string;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Omit<ControlNetEntry, 'id'>>) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useControlnets = create<ControlNetState>()(
  persist(
    (set) => ({
      entries: [],
      add: (name) => {
        const id = uid();
        set((s) => ({ entries: [...s.entries, { id, name, on: true, strength: 1, preprocessor: 'none', image: null }] }));
        return id;
      },
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      update: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    }),
    {
      name: 'imagelab.next.controlnets.v1',
      partialize: (s) => ({ entries: s.entries.map((e) => ({ ...e, image: null })) }),
    },
  ),
);
