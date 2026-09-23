/**
 * v1's five quick preset slots. A slot holds everything the left panel edits — the prompt parts
 * and the generation settings — except the input image, which is a picture and not a setting.
 * Loading a slot keeps whatever input image is loaded now.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '@/lib/store';
import type { Layer, WorkflowState } from '@/lib/types';

export const PRESET_SLOTS = 5;

export interface ParamPreset {
  workflow: Omit<WorkflowState, 'inputImage'>;
  layers: Layer[];
  savedAt: number;
}

interface ParamPresetState {
  slots: Record<number, ParamPreset>;
  /** The slot last saved or loaded. */
  active: number | null;
  save: (slot: number) => void;
  load: (slot: number) => void;
}

export const useParamPresets = create<ParamPresetState>()(
  persist(
    (set, get) => ({
      slots: {},
      active: null,
      save: (slot) => {
        const { workflow, layers } = useStore.getState();
        const { inputImage: _drop, ...rest } = workflow;
        const preset: ParamPreset = { workflow: structuredClone(rest), layers: structuredClone(layers), savedAt: Date.now() };
        set(s => ({ slots: { ...s.slots, [slot]: preset }, active: slot }));
      },
      load: (slot) => {
        const preset = get().slots[slot];
        if (!preset) return;
        const st = useStore.getState();
        st.setWorkflow(structuredClone(preset.workflow));
        st.setPromptLayers(structuredClone(preset.layers));
        set({ active: slot });
      },
    }),
    { name: 'imagelab.paramPresets.v1' },
  ),
);
