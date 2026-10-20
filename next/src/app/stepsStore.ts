/**
 * The chain of steps (design rule 2). A step = a workflow: a preset of every parameter, with its
 * own settings and its own outputs; it may take the previous step's output as input. The left rail
 * IS this list. Persisted; step 1 (Image) always exists.
 *
 * Who owns what: this store holds the chain, which step is active, and the session's name — of the
 * CURRENT session; `sessionsStore.ts` keeps every session and swaps this store's state on a tab switch. Each
 * step's parameters live in that step's own store (the Image step reuses the main app's
 * `useStore().workflow`; Refine / Upscale / Remove BG keep theirs on the step as `params`).
 * The pure rules are `stepsLogic.ts` (tested): the STEP I/O STANDARD (fix list 24) lives there.
 *
 * The contract other screens use (canvas "Send to next step", a drop on the rail, the viewer):
 *   `useSteps.getState().addStepAfter(kind, { after, input })`  or the plain `addStepAfter(kind, opts)` below.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useRoute } from './routeStore';
import {
  appendStep, insertStepAfter, moveStep as moveStepIn, newStep, clearStepInput, duplicateStepIn, removeStepFrom, restoreStepAt, withChainMode,
  STEP_LABEL, type ChainMode, type ChainPick, type Step, type StepInput, type StepKind, type StepParams,
} from './stepsLogic';

export {
  STEP_LABEL, STEP_HINT, STEP_IO, ADDABLE_KINDS, RESULT_SOURCE, DEFAULT_REFINE, DEFAULT_UPSCALE, DEFAULT_REMOVE_BG,
  stepTitle, nextStepId, prevStepId, chainModeOf, stepProblem, brokenChainMessage, clampFactor, modelScale,
} from './stepsLogic';
export type { Step, StepKind, StepInput, ChainMode, ChainPick, StepParams, StepIo, IoType, UpscaleParams, RemoveBgParams, StepReadiness } from './stepsLogic';

const uid = () => Math.random().toString(36).slice(2, 10);

export interface AddStepOptions {
  /** Insert after this step (default: at the end of the chain). */
  after?: string | null;
  /** The new step's explicit input (a picture sent to it); without one it chains to the step above. */
  input?: StepInput | null;
  /** The step's own name (default: the kind's label). */
  name?: string;
  /** Make it the active step (default true). */
  activate?: boolean;
}

interface StepsState {
  steps: Step[];
  activeId: string;
  /** The session = this named set of steps (rule 9's "Portrait session ▾"). */
  sessionName: string;
  setActive: (id: string) => void;
  /** Append a step of a kind (chained to the step above it). Returns its id. */
  addStep: (kind: StepKind, name?: string) => string;
  /** THE contract: add a step after another (or at the end), optionally with a picture as its input. Returns its id. */
  addStepAfter: (kind: StepKind, opts?: AddStepOptions) => string;
  /** Remove a step (step 1 never goes). Returns what was removed and where, for Undo; null when nothing happened. */
  removeStep: (id: string) => { step: Step; index: number } | null;
  /** Undo of `removeStep`: the step goes back where it was. */
  restoreStep: (step: Step, index: number) => void;
  /** A copy of a step right after it (step 1 is not copied). Returns the copy's id, or null. */
  duplicateStep: (id: string) => string | null;
  /** Drag to reorder: move a step to an index (step 1 stays first). The chain re-links itself. */
  moveStep: (id: string, toIndex: number) => void;
  updateStep: (id: string, patch: Partial<Omit<Step, 'id'>>) => void;
  /** Patch a step's own settings (`params`), one kind at a time. */
  updateParams: (id: string, patch: StepParams) => void;
  /** Give a step an explicit input (Send to step). Clears with null; the step chains again when it needs an input. */
  setStepInput: (id: string, input: StepInput | null) => void;
  /** Off · Auto · Pick for a step's input (`stepsLogic.withChainMode`); `pick` sets the chosen result in Pick mode. */
  setChainMode: (id: string, mode: ChainMode, pick?: ChainPick | null) => void;
  renameSession: (name: string) => void;
}

const FIRST: Step = { id: 'step-image', kind: 'image', name: 'Image', edited: false, chained: false };

export const useSteps = create<StepsState>()(
  persist(
    (set, get) => ({
      steps: [FIRST],
      activeId: FIRST.id,
      /** Blank until named (item 20): the UI shows the "Untitled session" placeholder. Sessions: `sessionsStore.ts`. */
      sessionName: '',
      setActive: (activeId) => set({ activeId }),
      addStep: (kind, name) => {
        const id = `step-${uid()}`;
        set((s) => ({ steps: appendStep(s.steps, newStep(id, kind, name)), activeId: id }));
        return id;
      },
      addStepAfter: (kind, opts = {}) => {
        const id = `step-${uid()}`;
        set((s) => ({
          steps: insertStepAfter(s.steps, opts.after ?? null, newStep(id, kind, opts.name, opts.input)),
          activeId: opts.activate === false ? s.activeId : id,
        }));
        return id;
      },
      removeStep: (id) => {
        const s = get();
        const index = s.steps.findIndex((x) => x.id === id);
        if (index <= 0) return null;
        const step = s.steps[index];
        set(removeStepFrom(s.steps, id, s.activeId));
        return { step, index };
      },
      restoreStep: (step, index) => set((s) => ({ steps: restoreStepAt(s.steps, step, index) })),
      duplicateStep: (id) => {
        const i = get().steps.findIndex((x) => x.id === id);
        if (i <= 0) return null;
        const copyId = `step-${uid()}`;
        set((s) => ({ steps: duplicateStepIn(s.steps, id, copyId), activeId: copyId }));
        return copyId;
      },
      moveStep: (id, toIndex) => set((s) => ({ steps: moveStepIn(s.steps, id, toIndex) })),
      updateStep: (id, patch) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      updateParams: (id, patch) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? { ...x, params: { ...x.params, ...patch } } : x)) })),
      setStepInput: (id, input) => set((s) => ({
        steps: s.steps.map((x) => (x.id !== id ? x : input ? { ...x, input, chained: false } : clearStepInput(x))),
      })),
      setChainMode: (id, mode, pick) => set((s) => ({ steps: s.steps.map((x) => (x.id === id ? withChainMode(x, mode, pick) : x)) })),
      renameSession: (sessionName) => set({ sessionName: sessionName.trim() }),
    }),
    {
      name: 'imagelab.next.steps.v1',
      // Step 1 is always there, whatever an old save holds.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StepsState>;
        const steps = p.steps?.length && p.steps[0].kind === 'image' ? p.steps : [FIRST, ...(p.steps ?? []).filter((s) => s.kind !== 'image')];
        const activeId = steps.some((s) => s.id === p.activeId) ? p.activeId! : steps[0].id;
        return { ...current, ...p, steps: steps.map((s) => (s.kind in STEP_LABEL ? s : { ...s, kind: 'workflow' as StepKind })), activeId };
      },
    },
  ),
);

/** The active step; falls back to step 1 if the saved id is gone. */
export const useActiveStep = () => useSteps((s) => s.steps.find((x) => x.id === s.activeId) ?? s.steps[0]);

/**
 * Add a step of `kind` after `after` (default: after the active step) with `input` as its
 * picture, outside React. Returns the new step's id. Canvas (31 / 43), compose (42: a drop on the
 * rail) and the viewer (30) call this; the step picks the picture up by the I/O standard.
 */
export function addStepAfter(kind: StepKind, opts: AddStepOptions = {}): string {
  const s = useSteps.getState();
  const id = s.addStepAfter(kind, { ...opts, after: opts.after === undefined ? s.activeId : opts.after });
  // The new step is open on the step screen (unless the caller keeps the current one).
  if (opts.activate !== false) useRoute.getState().go('step');
  return id;
}
