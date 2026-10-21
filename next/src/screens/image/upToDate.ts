/**
 * Item 17, "no duplicate outputs": a Generate whose step is already up to date (same settings,
 * same input, same seed as its newest output or a job already on its way) would only make the
 * same picture again — ComfyUI re-serves its cached result and the app would save it twice; other
 * providers would pay for it twice. So it is skipped: no job, no history entry; the rail badge and
 * the Generate button flash "Up to date" instead. A press that re-rolls a seed always runs.
 */
import { useStore } from '@/lib/store';
import { useStudio } from '@/features/studio/studioStore';
import { DEFAULT_UPSCALE, type Step } from '~/app/stepsStore';
import { flashUpToDate, isDuplicateRun } from '~/app/stepFingerprint';
import { stepWorkflowNow } from '~/screens/comfy';
import { keptSeedsNow } from './workflow/workflowStepStore';
import { seedIdsToReroll } from './workflow/workflowStepLogic';

/** Whether this press of the step's Generate (or its dice, `newSeed`) re-rolls a seed: then it is a new picture. */
export function rerollsOn(step: Step, newSeed: boolean): boolean {
  if (newSeed) return true;
  const random = useStore.getState().workflow.randomizeSeed;
  switch (step.kind) {
    case 'image':
    case 'refine': return random;
    case 'upscale': return ({ ...DEFAULT_UPSCALE, ...step.params?.upscale }).refine && random;
    case 'remove-bg':
    case 'video': return false;
    case 'workflow': {
      const ref = stepWorkflowNow(step.id);
      const st = useStudio.getState();
      // Not the open workflow: its seeds cannot be read here, so treat it as a new run.
      if (!ref || st.path !== ref.path) return true;
      return seedIdsToReroll(st.params, keptSeedsNow(st.path), false).length > 0;
    }
    default: return true;
  }
}

/** True (and flashes "Up to date") when this press would only repeat the step's current output. */
export function skipIfUpToDate(step: Step, newSeed: boolean): boolean {
  if (!isDuplicateRun(step.id, rerollsOn(step, newSeed))) return false;
  flashUpToDate(step.id);
  return true;
}
