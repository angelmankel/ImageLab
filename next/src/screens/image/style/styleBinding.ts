/**
 * Style tab: where the references live. ONE tab for every step that samples:
 *   - the Image step: `workflow.styleRefs` (the main store), CFG = the workflow's;
 *   - a Refine step: `step.params.styleRefs`, CFG = the Refine rounds' own;
 *   - an Upscale step: `step.params.styleRefs`, used by its "Refine after upscale" pass.
 * Each edit is one undo step. "Use step 1's references" (Refine / Upscale, off by default) adds
 * step 1's references to the refine pass at queue time (`kinds/kindRun.ts`).
 */
import { useStore } from '@/lib/store';
import type { StyleRef, StyleWhere } from '@/lib/styleRefs';
import { setWorkflowUndoable } from '~/app/undoableWorkflow';
import { pushUndo } from '~/app/undo';
import { useSteps, DEFAULT_REFINE, DEFAULT_UPSCALE, type Step, type StepParams } from '~/app/stepsStore';

export interface StyleBinding {
  where: StyleWhere;
  refs: StyleRef[];
  /** The CFG the references sample at (InstantID wants ≤ 5). */
  cfg: number;
  /** Replace the references (one undo); `cfg` lowers the CFG with them, when the binding can. */
  setRefs: (next: StyleRef[], label: string, cfg?: number) => void;
  /** Set the CFG (absent: this binding's CFG is not its own, e.g. Upscale's refine pass lowers it at queue time). */
  setCfg?: (cfg: number) => void;
  /** Refine / Upscale: "Use step 1's references". */
  step1?: { on: boolean; count: number; set: (on: boolean) => void };
  /** A line on top (Upscale with "Refine after upscale" off). */
  note?: string;
}

const NONE: StyleRef[] = [];

export function useImageStyleBinding(): StyleBinding {
  const refs = useStore((s) => s.workflow.styleRefs) ?? NONE;
  const cfg = useStore((s) => s.workflow.cfg);
  return {
    where: 'image', refs, cfg,
    setRefs: (styleRefs, label, c) => setWorkflowUndoable({ styleRefs, ...(c != null ? { cfg: c } : {}) }, label),
    setCfg: (c) => setWorkflowUndoable({ cfg: c }, `CFG ${c}`),
  };
}

/** Patch a step's params with one undo entry. */
function patchParams(stepId: string, patch: Partial<StepParams>, label: string): void {
  const st = useSteps.getState();
  const before = st.steps.find((s) => s.id === stepId)?.params ?? {};
  const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]])) as Partial<StepParams>;
  st.updateParams(stepId, patch);
  pushUndo({
    label,
    mergeKey: `step:${stepId}:${Object.keys(patch).sort().join(',')}`,
    undo: () => useSteps.getState().updateParams(stepId, prev),
    redo: () => useSteps.getState().updateParams(stepId, patch),
  });
}

export function useStepStyleBinding(step: Step): StyleBinding {
  const step1Refs = useStore((s) => s.workflow.styleRefs) ?? NONE;
  const wfCfg = useStore((s) => s.workflow.cfg);
  const refs = step.params?.styleRefs ?? NONE;
  const refine = step.kind === 'refine';
  const lb = { ...DEFAULT_REFINE, ...step.params?.refine };
  const up = { ...DEFAULT_UPSCALE, ...step.params?.upscale };
  const count = step1Refs.filter((r) => r.on && r.images.length).length;
  return {
    where: 'refine',
    refs,
    cfg: refine ? lb.cfg : wfCfg,
    setRefs: (styleRefs, label, c) => patchParams(step.id, { styleRefs, ...(refine && c != null ? { refine: { ...lb, cfg: c } } : {}) }, label),
    setCfg: refine ? (c) => patchParams(step.id, { refine: { ...lb, cfg: c } }, `CFG ${c}`) : undefined,
    step1: { on: !!step.params?.styleFromStep1, count, set: (on) => patchParams(step.id, { styleFromStep1: on || undefined }, on ? "Use step 1's references" : "Stop using step 1's references") },
    note: step.kind === 'upscale' && !up.refine ? 'These apply to "Refine after upscale": turn it on in Parameters.' : undefined,
  };
}
