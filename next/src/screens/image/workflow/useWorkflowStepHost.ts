/**
 * Everything a Workflow step's tabs need to know about where it runs: the host (the saved
 * workflow's own server, else the Workflow mode's), that host's `/object_info`, and whether the
 * step's workflow is the one open in the studio store (the tabs read their widgets from there;
 * `ensureStepWorkflowOpen` loads it when the step becomes active or a workflow is picked).
 */
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { useStudio } from '@/features/studio/studioStore';
import { useModeHost } from '@/features/workspace/modeHost';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { useStepWorkflow, type StepWorkflowRef } from '~/screens/comfy';
import { useSteps, type Step } from '~/app/stepsStore';

export interface WorkflowStepHost {
  ref: StepWorkflowRef | null;
  host: string | null;
  info: ObjectInfo | null;
  infoError: string | null;
  /** The step's workflow is the studio store's open one: its widgets are live. */
  open: boolean;
  /** A workflow is picked but not loaded yet. */
  loading: boolean;
}

export function useWorkflowStepHost(step: Step): WorkflowStepHost {
  const ref = useStepWorkflow(step.id);
  const modeHost = useModeHost('workflow');
  const host = ref?.host ?? modeHost;
  const { info, error } = useObjectInfo(host);
  const path = useStudio((s) => s.path);
  const hasGraph = useStudio((s) => !!s.workflow);
  const open = !!ref && path === ref.path && hasGraph;
  return { ref, host, info, infoError: error, open, loading: !!ref && !open };
}

/** Marks the step "edited" (the workflow row's badge) once a widget differs from the saved file. */
export function markStepEdited(stepId: string): void {
  const s = useSteps.getState();
  const st = s.steps.find((x) => x.id === stepId);
  if (st && !st.edited) s.updateStep(stepId, { edited: true });
}
