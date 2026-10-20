/**
 * "Use same models as step 1" for a Workflow step (fix list item 40): the step's loader widgets
 * mirror the Image step's models LIVE — checkpoint slot ← step 1's base checkpoint, LoRA slots ←
 * step 1's switched-on LoRAs in order, ControlNet / VAE / embedding slots likewise — unless the
 * step is switched off the link or a single slot was un-linked (`followStore`). A slot whose
 * loader does not offer step 1's file (a UNET loader vs an SDXL checkpoint) is left as it is.
 *
 * `useWorkflowFollow` (mounted once in `AppEffects`) re-syncs whenever step 1, the open workflow
 * or the links change; the run calls `syncWorkflowFollow` right before it builds the graph, so a
 * Generate always sends what step 1 has now. The diff is the pure `followOps`.
 */
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useStudio } from '@/features/studio/studioStore';
import type { WorkflowParam } from '@/features/studio/params';
import { useSteps, type Step } from '~/app/stepsStore';
import { stepWorkflowNow, useWorkflowStore } from '~/screens/comfy';
import { useControlnets } from '../model/controlnetStore';
import { canFollow, followOps, linkKey, type FollowCaps, type TargetEntry } from '../model/followLogic';
import { stepFollowNow, useFollowStore } from '../model/followStore';
import { step1Source } from '../model/step1Source';
import { usePendingModels } from '../model/pendingModels';
import type { ModelKind } from '../model/kindSpecs';
import { matchOption, strengthWidgets, workflowEntries, workflowKinds } from './workflowKinds';

const NO_VALUES: Record<string, unknown> = Object.freeze({});

/** A workflow's slots are fixed and have no On/Off; strengths follow, a checkpoint has none to follow. */
export const workflowCaps = (kind: ModelKind): FollowCaps => ({ canAdd: false, canRemove: false, hasSwitch: false, syncWeight: kind !== 'checkpoint' });

/** Does this step follow step 1 at all (its kind, its place, its switch)? */
export function stepFollows(step: Step, steps: readonly Step[]): boolean {
  return canFollow(step.kind, steps.findIndex((s) => s.id === step.id)) && !stepFollowNow(step.id).off;
}

/**
 * Makes the open workflow's linked slots match step 1. A no-op unless `step`'s workflow is the
 * studio store's open one and the step follows. Writes only what differs (idempotent).
 */
export function syncWorkflowFollow(step: Step): void {
  const steps = useSteps.getState().steps;
  if (!stepFollows(step, steps)) return;
  const ref = stepWorkflowNow(step.id);
  const st = useStudio.getState();
  if (!ref || !st.path || st.path !== ref.path || !st.workflow) return;
  const params: readonly WorkflowParam[] = st.params;
  const values = st.values[st.path] ?? NO_VALUES;
  const unlinked = new Set(stepFollowNow(step.id).unlinked ?? []);
  for (const kind of workflowKinds(params)) {
    const source = step1Source(kind);
    if (!source.length) continue;
    const entries: TargetEntry[] = workflowEntries(params, values, kind).map((e) => ({ ...e, linked: !unlinked.has(linkKey(kind, e.id)) }));
    for (const op of followOps(kind, source, entries, workflowCaps(kind))) {
      if (op.op === 'add') continue;
      const p = params.find((x) => x.id === op.id);
      if (!p) continue;
      if (op.op === 'rename') {
        // Only a file the loader offers: anything else would fail the run.
        const file = matchOption((p.options ?? []).map(String), op.name);
        if (file && file !== (op.id in values ? values[op.id] : p.value)) st.setValue(op.id, file);
      } else if (op.op === 'setWeight') {
        const main = strengthWidgets(params, p).main;
        if (main) st.setValue(main.id, op.weight);
      }
    }
  }
}

/** Live: re-sync the Workflow step whose workflow is open whenever anything it depends on changes. */
export function useWorkflowFollow(): void {
  const checkpoints = useStore((s) => s.workflow.checkpoints);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings);
  const vae = useStore((s) => s.workflow.vae);
  const controlnets = useControlnets((s) => s.entries);
  const records = usePendingModels((s) => s.records);
  const path = useStudio((s) => s.path);
  const params = useStudio((s) => s.params);
  const values = useStudio((s) => (s.path ? s.values[s.path] : undefined));
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const byStep = useWorkflowStore((s) => s.byStep);
  const follow = useFollowStore((s) => s.byStep);
  useEffect(() => {
    if (!path) return;
    // The step showing this workflow: the active one if it does, else the first that does.
    const holders = steps.filter((s) => s.kind === 'workflow' && byStep[s.id]?.path === path);
    const step = holders.find((s) => s.id === activeId) ?? holders[0];
    if (step) syncWorkflowFollow(step);
  }, [checkpoints, loras, embeddings, vae, controlnets, records, path, params, values, steps, activeId, byStep, follow]);
}
