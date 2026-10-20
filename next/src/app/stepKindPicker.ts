/**
 * THE step-kind picker (fix list 24 / 31 / 42 / 43): one small popover that lists the step kinds
 * a user can add (`ADDABLE_KINDS`: Refine · Upscale · Remove BG · Video · Workflow) and calls back
 * with the pick. Built on the app's menu host (`~/app/contextMenu`), so it opens beside a button
 * or at a point (a drop), works with the keyboard and becomes a sheet on the phone.
 *
 *   import { openStepKindPicker, addStepWithPicker } from '~/app/stepKindPicker';
 *   openStepKindPicker(buttonEl, (kind) => …);                       // any use
 *   addStepWithPicker(buttonEl, { after: stepId, input: { url, name } }); // pick → new step after `after` with that picture
 */
import { IconArrowsMaximize, IconGitBranch, IconMovie, IconPhoto, IconScissors, IconWand } from '@tabler/icons-react';
import { registerMenu } from './contextMenu';
import { addStepAfter, ADDABLE_KINDS, STEP_HINT, STEP_LABEL, type AddStepOptions, type StepKind } from './stepsStore';
import { openMenu } from './contextMenu';

/** One icon per step kind (the rail circle, the picker, the panel header). */
export const KIND_ICON: Record<StepKind, typeof IconPhoto> = {
  image: IconPhoto, refine: IconWand, upscale: IconArrowsMaximize, 'remove-bg': IconScissors, video: IconMovie, workflow: IconGitBranch,
};

interface PickerTarget { onPick: (kind: StepKind) => void; kinds: readonly StepKind[] }

registerMenu<PickerTarget>('step-kind', ADDABLE_KINDS.map((kind, i) => ({
  id: `kind-${kind}`,
  label: STEP_LABEL[kind],
  icon: KIND_ICON[kind],
  order: i,
  enabled: () => true,
  visible: (t) => t.kinds.includes(kind),
  action: (t) => t.onPick(kind),
})));

/** A short line per kind, for callers that draw their own list. */
export const KIND_HINT = STEP_HINT;

/**
 * Open the picker beside `at` (an element: below-left of it; `{ x, y }`: at that point).
 * `kinds` narrows the list (default: every addable kind). Returns false when nothing could open.
 */
export function openStepKindPicker(at: Element | { x: number; y: number }, onPick: (kind: StepKind) => void, kinds: readonly StepKind[] = ADDABLE_KINDS): boolean {
  // Beside a rail button reads better than under it: open at its right edge.
  const point = at instanceof Element ? (() => { const r = at.getBoundingClientRect(); return { x: r.right + 6, y: r.top }; })() : at;
  return openMenu('step-kind', { onPick, kinds } satisfies PickerTarget, point, { el: at instanceof Element ? at : null });
}

/** Pick a kind, then add that step (after `opts.after`, default the active step) with `opts.input` as its picture. */
export function addStepWithPicker(at: Element | { x: number; y: number }, opts: AddStepOptions = {}, onAdded?: (id: string, kind: StepKind) => void): boolean {
  return openStepKindPicker(at, (kind) => { const id = addStepAfter(kind, opts); onAdded?.(id, kind); });
}
