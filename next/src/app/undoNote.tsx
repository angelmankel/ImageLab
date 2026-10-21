/**
 * @deprecated List 2 #12: no more Undo toasts. Use `pushUndo({ label, undo, redo })` from `~/app/undo`.
 * Kept only so unshipped callers still build: it pushes an undo-only entry (redo does nothing).
 */
import { pushUndo } from './undo';

export function undoNote(what: string, onUndo: () => void): void {
  pushUndo({ label: what, undo: onUndo, redo: () => {} });
}
