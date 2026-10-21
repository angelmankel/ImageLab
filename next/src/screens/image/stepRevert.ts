/**
 * Fix list 2, "Revert to last run" (step right-click menu + the amber ↻ badge's popover): puts a
 * stale step's parameters and input back to what made its current output (the full settings kept
 * with the item-17 fingerprint), so it is up to date again (↻ → ✓); the steps below that were stale
 * only because of it turn ✓ on their own. One Ctrl+Z entry.
 *
 * What it restores: the Image step's workflow + prompt; Refine / Upscale / Remove BG their own
 * settings; Video the video settings; Workflow its workflow + values; step 2+ its input — when the
 * step above has made a newer picture since, the step is pointed (Pick) at the one it was made from.
 * Refine's model / prompt / seed belong to step 1 and are not touched from step 2.
 */
import { useStore } from '@/lib/store';
import type { WorkflowState } from '@/lib/types';
import { useVideo } from '@/features/video/videoStore';
import { useStudio } from '@/features/studio/studioStore';
import { useSteps } from '~/app/stepsStore';
import { pushUndo, withoutUndo } from '~/app/undo';
import { rawNow, savedRawOf, stepFreshnessNow, type StepRaw } from '~/app/stepFingerprint';
import { useWorkflowStore } from '~/screens/comfy/workflowStore';
import { allResultsNow, stepInputNow } from './useStepOutput';
import { toChainPick } from './stepInputLogic';

/** Why the step cannot be reverted, or null when it can. */
export function revertBlocked(stepId: string): string | null {
  const f = stepFreshnessNow(stepId);
  if (!f || f.state !== 'stale') return 'Already up to date';
  if (f.reason === 'above') return 'A step above changed';
  if (!savedRawOf(stepId)) return 'Last run not saved';
  return null;
}

type Image = WorkflowState['inputImage'];

function apply(stepId: string, raw: StepRaw, opts: { exact: boolean; image?: Image | undefined; outKey?: string }): void {
  const steps = useSteps.getState();
  withoutUndo(() => {
    switch (raw.kind) {
      case 'image': {
        const patch: Partial<WorkflowState> = { ...raw.workflow };
        const img = patch.inputImage as { dataUrl?: string } | null | undefined;
        // A big input picture was not kept with the settings: the output's history entry has it.
        if (img && img.dataUrl === '') {
          const fromEntry = opts.outKey ? useStore.getState().history.find((h) => h.id === opts.outKey)?.workflow?.inputImage : undefined;
          const pick = opts.image !== undefined ? opts.image : fromEntry;
          if (pick !== undefined) patch.inputImage = pick; else delete patch.inputImage;
        }
        const st = useStore.getState();
        st.setWorkflow(patch);
        if (raw.layers) st.setPromptLayers(raw.layers);
        break;
      }
      case 'refine': case 'upscale': case 'remove-bg':
        steps.updateStep(stepId, { params: raw.params });
        break;
      case 'video':
        if (raw.video) useVideo.getState().set(raw.video);
        break;
      case 'workflow': {
        const ref = raw.wf?.ref;
        if (!ref) break;
        useWorkflowStore.getState().setStepWorkflow(stepId, ref);
        const values = raw.wf?.values ?? {};
        const studio = useStudio.getState();
        if (studio.path === ref.path) {
          const now = studio.values[ref.path] ?? {};
          for (const id of Object.keys(now)) if (!(id in values)) studio.resetValue(id);
          for (const [id, v] of Object.entries(values)) if (now[id] !== v) studio.setValue(id, v);
        } else useStudio.setState((s) => ({ values: { ...s.values, [ref.path]: values } }));
        break;
      }
    }
    const inp = raw.input;
    if (!inp) return;
    steps.updateStep(stepId, { chained: inp.chained, input: inp.input ?? null, chainMode: inp.chainMode, chainPick: inp.chainPick ?? null });
    if (opts.exact || !inp.url) return;
    // The step above made a newer picture since: point this step at the one it was made from.
    const res = stepInputNow(stepId);
    if (res && res.kind === 'chained' && res.src.url !== inp.url) {
      const was = allResultsNow().find((r) => r.url === inp.url);
      if (was) steps.setChainMode(stepId, 'pick', toChainPick(was));
    }
  });
}

/** Revert a stale step to the settings of its last run. False when it cannot (`revertBlocked`). */
export function revertStep(stepId: string): boolean {
  if (revertBlocked(stepId)) return false;
  const saved = savedRawOf(stepId);
  const before = rawNow(stepId);
  if (!saved || !before) return false;
  const image = useStore.getState().workflow.inputImage;
  apply(stepId, saved.raw, { exact: false, outKey: saved.outKey });
  pushUndo({
    label: 'Revert step',
    undo: () => apply(stepId, before, { exact: true, image }),
    redo: () => apply(stepId, saved.raw, { exact: false, outKey: saved.outKey }),
  });
  return true;
}
