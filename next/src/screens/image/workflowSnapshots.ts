/**
 * The step's "Save / Revert": a saved snapshot of the Image step's workflow + prompt layers, in
 * localStorage per step, so "edited" means "differs from what you saved" and Revert can go back.
 * Steps 2+ get their own stores later; until then only the Image step saves.
 */
import { useStore } from '@/lib/store';
import type { Layer, WorkflowState } from '@/lib/types';

const key = (stepId: string) => `imagelab.next.step.${stepId}.saved.v1`;

export function saveSnapshot(stepId: string): void {
  const st = useStore.getState();
  const snap = { workflow: { ...st.workflow, inputImage: null }, layers: st.layers };
  try { localStorage.setItem(key(stepId), JSON.stringify(snap)); } catch { /* quota: the save is best effort */ }
}

export function loadSnapshot(stepId: string): { workflow: WorkflowState; layers: Layer[] } | null {
  try {
    const raw = localStorage.getItem(key(stepId));
    return raw ? JSON.parse(raw) as { workflow: WorkflowState; layers: Layer[] } : null;
  } catch { return null; }
}

/** Put the saved snapshot back. Returns false when there is none. */
export function revertSnapshot(stepId: string): boolean {
  const snap = loadSnapshot(stepId);
  if (!snap) return false;
  const st = useStore.getState();
  st.setWorkflow({ ...snap.workflow, inputImage: st.workflow.inputImage });
  st.setPromptLayers(snap.layers);
  return true;
}

/** A duplicated session's step keeps the saved snapshot of the step it was copied from. */
export function copySnapshot(fromStepId: string, toStepId: string): void {
  try {
    const raw = localStorage.getItem(key(fromStepId));
    if (raw) localStorage.setItem(key(toStepId), raw);
  } catch { /* best effort */ }
}
