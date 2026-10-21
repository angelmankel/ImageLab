/**
 * Which saved ComfyUI workflow each step runs (rule 14: "Use as step"), plus the ComfyUI screen's
 * own memory: the chosen server (the picker, FIXLIST-2 #52), when each workflow was last used, and node counts
 * read from each file (keyed by its saved time so an edit in ComfyUI re-reads it). Persisted.
 *
 * The Image/Workflow step owner reads `useStepWorkflow(stepId)` to know what to run.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSteps } from '~/app/stepsStore';
import type { WorkflowSort, WorkflowType } from './workflowListLogic';

export type ComfyKind = 'image' | 'video';

/** The workflow a step runs: a file in a server's ComfyUI `workflows/` folder. */
export interface StepWorkflowRef {
  /** ComfyUI host it lives on (`pod:8188`, `pod/video-comfy`). */
  host: string;
  /** Server id in `@/lib/store` servers, when it is one of them. */
  serverId: string | null;
  /** Path under `workflows/`, as `listSavedWorkflows` reports it. */
  path: string;
  /** Display name (file name without `.json`). */
  name: string;
  kind: ComfyKind;
}

export interface WorkflowMeta { nodes: number; modified: number; type?: WorkflowType }

interface WorkflowStoreState {
  byStep: Record<string, StepWorkflowRef>;
  /** `workflowKey(host, path)` → epoch ms it was last used as a step or opened. */
  lastUsed: Record<string, number>;
  /** `workflowKey(host, path)` → node count of the version saved at `modified`. */
  meta: Record<string, WorkflowMeta>;
  kind: ComfyKind;
  /** The server picked for `kind`; null = the first that fits (`pickServerForMode`). */
  serverId: string | null;
  setStepWorkflow: (stepId: string, ref: StepWorkflowRef) => void;
  clearStep: (stepId: string) => void;
  markUsed: (key: string) => void;
  setMeta: (key: string, meta: WorkflowMeta) => void;
  setServer: (kind: ComfyKind, serverId: string | null) => void;
  /** The workflows list's order (FIXLIST-2 #53). */
  sort: WorkflowSort;
  setSort: (sort: WorkflowSort) => void;
  /** A file was renamed on `host`: move its memory (last used, meta) and the steps that run it. */
  renamePath: (host: string, from: string, to: string, name: string) => void;
}

export const workflowKey = (host: string, path: string) => `${host}|${path}`;

export const useWorkflowStore = create<WorkflowStoreState>()(
  persist(
    (set) => ({
      byStep: {},
      lastUsed: {},
      meta: {},
      kind: 'image',
      serverId: null,
      setStepWorkflow: (stepId, ref) => set((s) => ({ byStep: { ...s.byStep, [stepId]: ref } })),
      clearStep: (stepId) => set((s) => {
        if (!(stepId in s.byStep)) return s;
        const byStep = { ...s.byStep };
        delete byStep[stepId];
        return { byStep };
      }),
      markUsed: (key) => set((s) => ({ lastUsed: { ...s.lastUsed, [key]: Date.now() } })),
      setMeta: (key, meta) => set((s) => ({ meta: { ...s.meta, [key]: meta } })),
      setServer: (kind, serverId) => set({ kind, serverId }),
      sort: 'recent',
      setSort: (sort) => set({ sort }),
      renamePath: (host, from, to, name) => set((s) => {
        const a = workflowKey(host, from);
        const b = workflowKey(host, to);
        const lastUsed = { ...s.lastUsed };
        const meta = { ...s.meta };
        if (a in lastUsed) { lastUsed[b] = lastUsed[a]; delete lastUsed[a]; }
        if (a in meta) { meta[b] = meta[a]; delete meta[a]; }
        const byStep = Object.fromEntries(Object.entries(s.byStep).map(([id, r]) => [id, r.host === host && r.path === from ? { ...r, path: to, name } : r]));
        return { lastUsed, meta, byStep };
      }),
    }),
    { name: 'imagelab.next.comfy.v1' },
  ),
);

/** The workflow a step runs, or null when it was not made from a saved workflow. */
export function useStepWorkflow(stepId: string | null | undefined): StepWorkflowRef | null {
  return useWorkflowStore((s) => (stepId ? s.byStep[stepId] ?? null : null));
}

/** Outside React (a Generate handler). */
export const stepWorkflowNow = (stepId: string): StepWorkflowRef | null => useWorkflowStore.getState().byStep[stepId] ?? null;

// A removed step forgets its workflow.
useSteps.subscribe((s) => {
  const ids = new Set(s.steps.map((x) => x.id));
  const { byStep, clearStep } = useWorkflowStore.getState();
  for (const id of Object.keys(byStep)) if (!ids.has(id)) clearStep(id);
});
