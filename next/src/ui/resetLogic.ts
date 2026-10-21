/** Reset to default (FIXLIST-2 item 8), the pure part: equality and the undoable reset. */
import { pushUndo, withoutUndo } from '~/app/undo';

/**
 * Set `to`, remember `from` for Ctrl+Z: ONE entry ("Reset Steps"), even when `apply` is a setter
 * that records its own (useUndoableSetWorkflow) — that one is muted here and on undo / redo.
 */
export function resetWithUndo<V>(label: string, from: V, to: V, apply: (v: V) => void) {
  withoutUndo(() => apply(to));
  pushUndo({ label: `Reset ${label}`, undo: () => apply(from), redo: () => apply(to) });
}

/** Numbers: equal within a hair of the step (no float noise). */
export function sameValue(a: unknown, b: unknown, step = 1): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < Math.max(1e-9, step / 1000);
  return a === b;
}
