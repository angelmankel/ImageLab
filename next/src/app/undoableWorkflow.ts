/**
 * Parameter changes on the undo stack (fix list 2, item 12: "parameter changes where cheap").
 * `setWorkflowUndoable(patch)` = the main store's `setWorkflow` + one undo entry holding the old
 * values of exactly the patched keys. Same keys within 1.2 s merge (a slider drag = one Ctrl+Z).
 * Drop-in for `useStore((s) => s.setWorkflow)` in a parameter control:
 *   const set = useUndoableSetWorkflow();
 */
import { useStore } from '@/lib/store';
import type { WorkflowState } from '@/lib/types';
import { hintOf } from '~/ui/hints';
import { pushUndo } from './undo';

function labelOf(keys: string[]): string {
  if (keys.length !== 1) return 'Change settings';
  const meta = hintOf(keys[0]);
  return meta?.label ?? keys[0].charAt(0).toUpperCase() + keys[0].slice(1);
}

export function setWorkflowUndoable(patch: Partial<WorkflowState>, label?: string): void {
  const st = useStore.getState();
  const keys = Object.keys(patch) as Array<keyof WorkflowState>;
  if (!keys.length || keys.every((k) => st.workflow[k] === patch[k])) return;
  const before = Object.fromEntries(keys.map((k) => [k, st.workflow[k]])) as Partial<WorkflowState>;
  st.setWorkflow(patch);
  const sorted = [...keys].sort();
  pushUndo({
    label: label ?? labelOf(sorted),
    mergeKey: `wf:${sorted.join(',')}`,
    undo: () => useStore.getState().setWorkflow(before),
    redo: () => useStore.getState().setWorkflow(patch),
  });
}

/** The hook form (a stable function, so it can replace `useStore((s) => s.setWorkflow)` as is). */
export const useUndoableSetWorkflow = (): typeof setWorkflowUndoable => setWorkflowUndoable;
