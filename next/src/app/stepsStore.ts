/**
 * The chain of steps (design rule 2). A step = a workflow: a preset of every parameter, with its
 * own settings and its own outputs; it may take the previous step's output as input. The left rail
 * IS this list. Persisted; step 1 (Image) always exists.
 *
 * Who owns what: this store holds the chain, which step is active, and the session's name. Each
 * step's parameters live in that step's own store (the Image step reuses the main app's
 * `useStore().workflow`); the "settings per step" split comes when step 2+ generate for real.
 * The pure rules are `stepsLogic.ts` (tested).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appendStep, removeStepFrom, withChainMode, STEP_LABEL, type ChainMode, type ChainPick, type Step, type StepInput, type StepKind } from './stepsLogic';

export { STEP_LABEL, stepTitle, nextStepId, prevStepId, chainModeOf } from './stepsLogic';
export type { Step, StepKind, StepInput, ChainMode, ChainPick } from './stepsLogic';

const uid = () => Math.random().toString(36).slice(2, 10);

interface StepsState {
  steps: Step[];
  activeId: string;
  /** The session = this named set of steps (rule 9's "Portrait session ▾"). */
  sessionName: string;
  setActive: (id: string) => void;
  addStep: (kind: StepKind, name?: string) => string;
  removeStep: (id: string) => void;
  updateStep: (id: string, patch: Partial<Omit<Step, 'id'>>) => void;
  /** Give a step an explicit input (Send to step). Clears with null; the step stops chaining. */
  setStepInput: (id: string, input: StepInput | null) => void;
  /** Off · Auto · Pick for a step's input (`stepsLogic.withChainMode`); `pick` sets the chosen result in Pick mode. */
  setChainMode: (id: string, mode: ChainMode, pick?: ChainPick | null) => void;
  renameSession: (name: string) => void;
}

const FIRST: Step = { id: 'step-image', kind: 'image', name: 'Portrait · SDXL', edited: false, chained: false };

export const useSteps = create<StepsState>()(
  persist(
    (set) => ({
      steps: [FIRST],
      activeId: FIRST.id,
      sessionName: 'Portrait session',
      setActive: (activeId) => set({ activeId }),
      addStep: (kind, name) => {
        const id = `step-${uid()}`;
        set((s) => ({ steps: appendStep(s.steps, { id, kind, name: name ?? STEP_LABEL[kind], edited: false }), activeId: id }));
        return id;
      },
      removeStep: (id) => set((s) => removeStepFrom(s.steps, id, s.activeId)),
      updateStep: (id, patch) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      setStepInput: (id, input) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, input, chained: input ? false : x.chained } : x)) })),
      setChainMode: (id, mode, pick) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? withChainMode(x, mode, pick) : x)) })),
      renameSession: (sessionName) => set({ sessionName: sessionName.trim() || 'Session' }),
    }),
    {
      name: 'imagelab.next.steps.v1',
      // Step 1 is always there, whatever an old save holds.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StepsState>;
        const steps = p.steps?.length && p.steps[0].kind === 'image' ? p.steps : [FIRST, ...(p.steps ?? []).filter((s) => s.kind !== 'image')];
        const activeId = steps.some((s) => s.id === p.activeId) ? p.activeId! : steps[0].id;
        return { ...current, ...p, steps, activeId };
      },
    },
  ),
);

/** The active step; falls back to step 1 if the saved id is gone. */
export const useActiveStep = () => useSteps((s) => s.steps.find((x) => x.id === s.activeId) ?? s.steps[0]);
