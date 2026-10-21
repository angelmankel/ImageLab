/**
 * Fix list 24: what the rail's ×, its right-click menu and the panel header's ▾ do to a step, in
 * one place. Remove has no confirm and no toast: it goes on the undo stack (Ctrl+Z, list 2 #12), and
 * the Undo puts the step back where it was with the workflow it ran (the ComfyUI screen's binding is dropped
 * when a step goes, so it is kept here and restored). Rename opens a small box.
 */
import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useRoute } from '~/app/routeStore';
import { useSteps, type Step } from '~/app/stepsStore';
import { pushUndo } from '~/app/undo';
import { stepWorkflowNow, useWorkflowStore } from '~/screens/comfy';
import { Button } from '~/ui/Button';

/** Remove a step (never step 1); Ctrl+Z puts it back. */
export function removeStepWithUndo(id: string): void {
  const st = useSteps.getState();
  const wasActive = st.activeId === id;
  const bound = stepWorkflowNow(id);
  const removed = st.removeStep(id);
  if (!removed) return;
  pushUndo({
    label: 'Remove step',
    undo: () => {
      useSteps.getState().restoreStep(removed.step, removed.index);
      if (bound) useWorkflowStore.getState().setStepWorkflow(removed.step.id, bound);
      if (wasActive) useSteps.getState().setActive(removed.step.id);
    },
    redo: () => { useSteps.getState().removeStep(removed.step.id); },
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

/** Move a step to `to` (step 1 stays first); Ctrl+Z moves it back. */
export function moveStepTo(id: string, to: number): void {
  const st = useSteps.getState();
  const i = st.steps.findIndex((s) => s.id === id);
  if (i <= 0 || i === to) return;
  st.moveStep(id, to);
  pushUndo({ label: 'Move step', undo: () => useSteps.getState().moveStep(id, i), redo: () => useSteps.getState().moveStep(id, to) });
}

/** Move a step up (-1) or down (+1); step 1 stays first. */
export function moveStepBy(id: string, delta: number): void {
  const i = useSteps.getState().steps.findIndex((s) => s.id === id);
  if (i > 0) moveStepTo(id, i + delta);
}

function renameStep(step: Step, name: string): void {
  const before = step.name;
  useSteps.getState().updateStep(step.id, { name });
  pushUndo({ label: 'Rename step', undo: () => useSteps.getState().updateStep(step.id, { name: before }), redo: () => useSteps.getState().updateStep(step.id, { name }) });
}

function RenameForm({ step, close }: { step: Step; close: () => void }) {
  const [draft, setDraft] = useState(step.name);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const name = draft.trim(); if (name && name !== step.name) renameStep(step, name); close(); }} style={{ display: 'flex', gap: 6 }}>
      <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Step name" />
      <Button type="submit" tone="primary">Rename</Button>
    </form>
  );
}

/** A small box to rename the step (its own name; the session's name is the shell's). */
export function renameStepPrompt(step: Step): void {
  const id = modals.open({ title: 'Rename the step', size: 'xs', centered: true, children: <RenameForm step={step} close={() => modals.close(id)} /> });
}
