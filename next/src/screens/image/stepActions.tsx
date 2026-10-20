/**
 * Fix list 24: what the rail's ×, its right-click menu and the panel header's ▾ do to a step, in
 * one place. Remove has no confirm: a 3 s note offers Undo (Donny's default), and the Undo puts
 * the step back where it was with the workflow it ran (the ComfyUI screen's binding is dropped
 * when a step goes, so it is kept here and restored). Rename opens a small box.
 */
import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useRoute } from '~/app/routeStore';
import { useSteps, type Step } from '~/app/stepsStore';
import { undoNote } from '~/app/undoNote';
import { stepWorkflowNow, useWorkflowStore } from '~/screens/comfy';
import { Button } from '~/ui/Button';

/** Remove a step (never step 1) with a 3 s Undo. */
export function removeStepWithUndo(id: string): void {
  const st = useSteps.getState();
  const wasActive = st.activeId === id;
  const bound = stepWorkflowNow(id);
  const removed = st.removeStep(id);
  if (!removed) return;
  undoNote(`${removed.step.name || 'Step'} removed`, () => {
    useSteps.getState().restoreStep(removed.step, removed.index);
    if (bound) useWorkflowStore.getState().setStepWorkflow(removed.step.id, bound);
    if (wasActive) useSteps.getState().setActive(removed.step.id);
  });
}

/** A copy right after the step, with the workflow it runs. Opens the copy. */
export function duplicateStep(id: string): void {
  const copy = useSteps.getState().duplicateStep(id);
  if (!copy) return;
  const bound = stepWorkflowNow(id);
  if (bound) useWorkflowStore.getState().setStepWorkflow(copy, bound);
  useRoute.getState().go('step');
}

/** Move a step up (-1) or down (+1); step 1 stays first. */
export function moveStepBy(id: string, delta: number): void {
  const st = useSteps.getState();
  const i = st.steps.findIndex((s) => s.id === id);
  if (i <= 0) return;
  st.moveStep(id, i + delta);
}

function RenameForm({ step, close }: { step: Step; close: () => void }) {
  const [draft, setDraft] = useState(step.name);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const name = draft.trim(); if (name) useSteps.getState().updateStep(step.id, { name }); close(); }} style={{ display: 'flex', gap: 6 }}>
      <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Step name" />
      <Button type="submit" tone="primary">Rename</Button>
    </form>
  );
}

/** A small box to rename the step (its own name; the session's name is the shell's). */
export function renameStepPrompt(step: Step): void {
  const id = modals.open({ title: 'Rename the step', size: 'xs', centered: true, children: <RenameForm step={step} close={() => modals.close(id)} /> });
}
