/**
 * Send-to targets that exist whatever is on screen (fix list 42, the phone fallback): "New step
 * with this picture…" (the step-kind picker, then a step at the end of the chain with it as its
 * input). Mounted by `SendToSheet`. Renders nothing.
 */
import { useRegisterDropTarget } from './targets';
import { newStepFromDrop } from './railDrop';

export function GlobalTargets(): null {
  useRegisterDropTarget({
    id: 'step:new', label: 'New step with this picture…', group: 'step', order: 0,
    onDrop: (item) => void newStepFromDrop(item, { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 3) }),
  });
  return null;
}
