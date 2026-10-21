/**
 * The undo / redo stack, pure (fix list 2, item 12). `undo.ts` keeps one of these per session.
 *
 *   push(e)  → past += e, future cleared. Same `mergeKey` as the top entry within `MERGE_MS`
 *              → one entry (keeps the first `undo`, takes the newest `redo`): a slider drag is
 *              one undo, not forty.
 *   undo()   → pops past, runs its `undo`, moves it to future.
 *   redo()   → pops future, runs its `redo`, moves it back to past.
 * At most `LIMIT` entries are kept (oldest dropped).
 */

export interface UndoAction {
  /** What the action did, short: "Delete image", "Remove step", "Steps". Shown in the Undo button tooltip. */
  label: string;
  undo: () => void;
  redo: () => void;
  /** Entries with the same key pushed within MERGE_MS of each other become one (parameter drags, typing in a field). */
  mergeKey?: string;
}

export interface UndoEntry extends UndoAction { at: number }

export interface UndoStack { past: UndoEntry[]; future: UndoEntry[] }

export const LIMIT = 100;
export const MERGE_MS = 1200;

export const emptyStack = (): UndoStack => ({ past: [], future: [] });

export function pushEntry(stack: UndoStack, action: UndoAction, now: number): UndoStack {
  const top = stack.past[stack.past.length - 1];
  if (top && action.mergeKey && top.mergeKey === action.mergeKey && now - top.at <= MERGE_MS) {
    const merged: UndoEntry = { ...top, label: action.label, redo: action.redo, at: now };
    return { past: [...stack.past.slice(0, -1), merged], future: [] };
  }
  const past = [...stack.past, { ...action, at: now }];
  return { past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past, future: [] };
}

/** The stack after an undo, plus the entry whose `undo` to run (null when nothing to undo). */
export function popUndo(stack: UndoStack): { stack: UndoStack; entry: UndoEntry | null } {
  const entry = stack.past[stack.past.length - 1];
  if (!entry) return { stack, entry: null };
  return { stack: { past: stack.past.slice(0, -1), future: [...stack.future, entry] }, entry };
}

/** The stack after a redo, plus the entry whose `redo` to run. */
export function popRedo(stack: UndoStack): { stack: UndoStack; entry: UndoEntry | null } {
  const entry = stack.future[stack.future.length - 1];
  if (!entry) return { stack, entry: null };
  return { stack: { past: [...stack.past, { ...entry, at: Number.NEGATIVE_INFINITY }], future: stack.future.slice(0, -1) }, entry };
}
