/**
 * "Recommended settings" → the step in one tap (fix list 2 items 29 + 33): the steps / CFG /
 * sampler (+ scheduler) / clip skip the model's sample pictures were made with go into the shared
 * workflow, and a LoRA's / embedding's usual strength into its entry. No toast (item 12): the
 * button says "Applied" once the step matches, and Ctrl+Z puts the old values back.
 */
import { useStore } from '@/lib/store';
import type { WorkflowState } from '@/lib/types';
import { samplerOf } from '~/app/actions';
import { useSteps } from '~/app/stepsStore';
import { pushUndo } from '~/app/undo';
import type { Recommended } from './cardFacts';

type Patch = Partial<Pick<WorkflowState, 'steps' | 'cfg' | 'sampler' | 'scheduler' | 'clipSkip'>>;

/** What applying `rec` would change, read against the server's sampler / scheduler lists. */
export function recommendedPatch(rec: Recommended): Patch {
  const st = useStore.getState();
  const patch: Patch = {};
  if (rec.steps != null && rec.steps > 0) patch.steps = Math.round(rec.steps);
  if (rec.cfg != null && rec.cfg > 0) patch.cfg = rec.cfg;
  if (rec.clipSkip != null && rec.clipSkip > 0) patch.clipSkip = -Math.round(rec.clipSkip);
  if (rec.sampler) {
    const s = samplerOf(rec.sampler, st.server.samplers, st.server.schedulers);
    if (s.sampler) patch.sampler = s.sampler;
    if (s.scheduler) patch.scheduler = s.scheduler;
  }
  return patch;
}

export interface WeightTarget { value: number; set: (v: number) => void }

/** True when the step already uses every recommended value (and the strength, when given). */
export function useRecommendedApplied(rec: Recommended, weight?: WeightTarget): boolean {
  const wf = useStore((s) => s.workflow);
  const patch = recommendedPatch(rec);
  const keys = Object.keys(patch) as (keyof Patch)[];
  const same = keys.every((k) => wf[k] === patch[k]);
  const w = rec.strength == null || !weight || Math.abs(weight.value - rec.strength) < 1e-6;
  return (keys.length > 0 || (rec.strength != null && !!weight)) && same && w;
}

export function applyRecommended(rec: Recommended, weight?: WeightTarget): void {
  const st = useStore.getState();
  const patch = recommendedPatch(rec);
  const keys = Object.keys(patch) as (keyof Patch)[];
  const prev = Object.fromEntries(keys.map((k) => [k, st.workflow[k]])) as Patch;
  const prevWeight = weight?.value;
  const doIt = () => {
    if (keys.length) useStore.getState().setWorkflow(patch);
    if (weight && rec.strength != null) weight.set(rec.strength);
    const steps = useSteps.getState().steps;
    if (steps[0]) useSteps.getState().updateStep(steps[0].id, { edited: true });
  };
  doIt();
  pushUndo({
    label: 'Apply recommended settings',
    undo: () => {
      if (keys.length) useStore.getState().setWorkflow(prev);
      if (weight && prevWeight != null) weight.set(prevWeight);
    },
    redo: doIt,
  });
}
