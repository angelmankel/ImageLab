/**
 * Pure helpers for the chain of steps (rule 2). No React, no stores: tested in
 * tests/steps.test.cjs. The store (`stepsStore.ts`) and the Rail/StepPanel use these.
 */
export type StepKind = 'image' | 'upscale' | 'video' | 'workflow';

export interface StepInput { url: string; name: string }

export interface Step {
  id: string;
  kind: StepKind;
  /** The workflow's name, shown in the workflow row ("Portrait · SDXL"). */
  name: string;
  /** True once a parameter differs from the saved workflow ("edited"). */
  edited: boolean;
  /** Takes the previous step's output as its input (chained). */
  chained: boolean;
  /** An explicit input picked for this step (Send to step, drop); wins over `chained` when set. */
  input?: StepInput | null;
}

export const STEP_LABEL: Record<StepKind, string> = { image: 'Image', upscale: 'Upscale', video: 'Video', workflow: 'Workflow' };

/** "1 · Image", "2 · Upscale": the rail's and the eyebrow's label. */
export const stepTitle = (steps: readonly Step[], id: string): string => {
  const i = steps.findIndex((s) => s.id === id);
  return i < 0 ? '' : `${i + 1} · ${STEP_LABEL[steps[i].kind]}`;
};

/** The step after `id`, or null at the end of the chain. */
export const nextStepId = (steps: readonly Step[], id: string): string | null => {
  const i = steps.findIndex((s) => s.id === id);
  return i >= 0 && i + 1 < steps.length ? steps[i + 1].id : null;
};

/** The step before `id`, or null for step 1. */
export const prevStepId = (steps: readonly Step[], id: string): string | null => {
  const i = steps.findIndex((s) => s.id === id);
  return i > 0 ? steps[i - 1].id : null;
};

/** Append a step; a new step chains to the one before it by default. */
export const appendStep = (steps: readonly Step[], step: Omit<Step, 'chained'> & { chained?: boolean }): Step[] =>
  [...steps, { chained: steps.length > 0, ...step }];

/** Remove a step; step 1 can never go. Returns the list and the id to make active if the removed one was. */
export const removeStepFrom = (steps: readonly Step[], id: string, activeId: string): { steps: Step[]; activeId: string } => {
  if (steps.length <= 1 || id === steps[0].id) return { steps: [...steps], activeId };
  const next = steps.filter((s) => s.id !== id);
  return { steps: next, activeId: activeId === id ? next[next.length - 1].id : activeId };
};
