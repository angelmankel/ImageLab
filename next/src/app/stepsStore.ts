/**
 * The chain of steps (design rule 2). A step = a workflow: a preset of every parameter, with its
 * own settings and its own outputs; it may take the previous step's output as input. The left rail
 * IS this list. Persisted; step 1 (Image) always exists.
 *
 * Who owns what: this store holds the chain and which step is active. Each step's parameters live
 * in that step's own store (the Image step reuses the main app's `useStore().workflow`); the
 * "settings per step" split comes when step 2+ generate for real.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StepKind = 'image' | 'upscale' | 'video' | 'workflow';

export interface Step {
  id: string;
  kind: StepKind;
  /** The workflow's name, shown in the workflow row ("Portrait · SDXL"). */
  name: string;
  /** True once a parameter differs from the saved workflow ("edited"). */
  edited: boolean;
  /** Takes the previous step's output as its input (chained). */
  chained: boolean;
}

export const STEP_LABEL: Record<StepKind, string> = { image: 'Image', upscale: 'Upscale', video: 'Video', workflow: 'Workflow' };

const uid = () => Math.random().toString(36).slice(2, 10);

interface StepsState {
  steps: Step[];
  activeId: string;
  setActive: (id: string) => void;
  addStep: (kind: StepKind, name?: string) => string;
  removeStep: (id: string) => void;
  updateStep: (id: string, patch: Partial<Omit<Step, 'id'>>) => void;
}

const FIRST: Step = { id: 'step-image', kind: 'image', name: 'Portrait · SDXL', edited: false, chained: false };

export const useSteps = create<StepsState>()(
  persist(
    (set) => ({
      steps: [FIRST],
      activeId: FIRST.id,
      setActive: (activeId) => set({ activeId }),
      addStep: (kind, name) => {
        const id = `step-${uid()}`;
        set((s) => ({ steps: [...s.steps, { id, kind, name: name ?? STEP_LABEL[kind], edited: false, chained: true }], activeId: id }));
        return id;
      },
      removeStep: (id) => set((s) => {
        if (s.steps.length <= 1 || id === s.steps[0].id) return s;
        const steps = s.steps.filter((x) => x.id !== id);
        return { steps, activeId: s.activeId === id ? steps[steps.length - 1].id : s.activeId };
      }),
      updateStep: (id, patch) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    }),
    { name: 'imagelab.next.steps.v1' },
  ),
);

/** The active step; falls back to step 1 if the saved id is gone. */
export const useActiveStep = () => useSteps((s) => s.steps.find((x) => x.id === s.activeId) ?? s.steps[0]);
