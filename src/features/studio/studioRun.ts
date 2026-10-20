/**
 * The workflow run: one store for the whole app (`lib/comfyRunner.ts`), so a saved ComfyUI
 * workflow keeps running and reporting while another mode is in use.
 */
import { createRunStore, type RunSource } from '@/lib/comfyRunner';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { buildApiGraph } from './params';
import { useStudio } from './studioStore';

export const useWorkflowRun = createRunStore(undefined, 'imagelab.workflow.deleted.v1');

export function workflowRunSource(info: ObjectInfo | null): RunSource {
  return {
    build: async () => {
      const { workflow, rerollSeeds } = useStudio.getState();
      if (!info || !workflow) return { error: 'Nothing open' };
      // A fresh seed per run is what anyone pressing Generate twice expects. ComfyUI's own
      // control_after_generate does this inside the editor; nothing does it for us out here.
      rerollSeeds();
      return buildApiGraph(workflow, info, useStudio.getState().currentValues());
    },
  };
}

/** Queue the open workflow on `host` with its current knob values. */
export function startWorkflowRun(host: string, info: ObjectInfo | null): Promise<void> {
  const st = useWorkflowRun.getState();
  st.setHost(host);
  return st.run(workflowRunSource(info));
}
