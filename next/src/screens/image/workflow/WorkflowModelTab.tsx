/**
 * The Workflow step's Model tab (rule 4: ONE model component for all models): the workflow
 * picker when none is chosen, then the universal `ModelList` on the step's own api
 * (`useWorkflowKindApi`) — one tab per kind the graph has a slot for, one circle per loader widget
 * (badged with its node's title), "Change ▾" into the big models modal (or the server-file grid
 * for text encoders and other loaders); no "+ Add": a workflow's slots are fixed. A file the
 * server lacks is the dimmed "not on server" / "not downloaded" state.
 */
import { useStudio } from '@/features/studio/studioStore';
import type { Step } from '~/app/stepsStore';
import { ModelList, type ModelKind } from '~/screens/image/model';
import { Hint } from './Hint';
import { WorkflowPicker } from './WorkflowPicker';
import { useWorkflowStepHost } from './useWorkflowStepHost';
import { workflowKinds } from './workflowKinds';
import { useWorkflowKindApi, WorkflowStepContext } from './useWorkflowKindApi';

const NO_KINDS: ModelKind[] = Object.freeze([]) as unknown as ModelKind[];

export function WorkflowModelTab({ step }: { step: Step }) {
  const { ref, open, loading } = useWorkflowStepHost(step);
  const params = useStudio((s) => s.params);
  const kinds = open ? workflowKinds(params) : NO_KINDS;
  return (
    <>
      {!ref && <WorkflowPicker step={step} />}
      {!ref && <Hint>Pick a workflow first.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !kinds.length && <Hint>This workflow has no model slot.</Hint>}
      {open && kinds.length > 0 && (
        <WorkflowStepContext.Provider value={step}>
          <ModelList key={ref?.path} kinds={kinds} useApi={useWorkflowKindApi} />
        </WorkflowStepContext.Provider>
      )}
    </>
  );
}
