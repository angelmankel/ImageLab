/**
 * Make a workflow step's saved workflow the Studio store's open one, so the step's Generate
 * (`startWorkflowRun(host, info)`) runs it without visiting the ComfyUI screen. Reads the file from
 * the step's own host and loads it with the Studio store's `loadWorkflow`; `/object_info` comes
 * from `useObjectInfo`'s cache when it is there, else it is fetched once and kept here.
 * No-op when the step has no saved workflow or it is already the open one.
 */
import { comfyHttpFor, loadSavedWorkflow } from '@/lib/comfy';
import { useStudio } from '@/features/studio/studioStore';
import { objectInfoNow } from '@/features/studio/useStudioRun';
import type { EditorWorkflowWithSubgraphs, ObjectInfo } from '@/lib/workflowGraph';
import { stepWorkflowNow, useWorkflowStore, workflowKey } from './workflowStore';

const infoCache = new Map<string, Promise<ObjectInfo>>();

function objectInfo(host: string): Promise<ObjectInfo> {
  const cached = objectInfoNow(host);
  if (cached) return Promise.resolve(cached);
  let p = infoCache.get(host);
  if (!p) {
    p = fetch(`${comfyHttpFor(host)}/object_info`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<ObjectInfo>;
    });
    p.catch(() => infoCache.delete(host));
    infoCache.set(host, p);
  }
  return p;
}

export async function ensureStepWorkflowOpen(stepId: string): Promise<void> {
  const ref = stepWorkflowNow(stepId);
  if (!ref) return;
  if (useStudio.getState().path === ref.path && useStudio.getState().workflow) return;
  const [wf, info] = await Promise.all([loadSavedWorkflow(ref.host, ref.path), objectInfo(ref.host)]);
  useStudio.getState().loadWorkflow(ref.path, wf as EditorWorkflowWithSubgraphs, info);
  useWorkflowStore.getState().markUsed(workflowKey(ref.host, ref.path));
}
