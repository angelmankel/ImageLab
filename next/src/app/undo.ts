/**
 * App-wide undo / redo (fix list 2, item 12). Replaces every "… · Undo" toast.
 *
 *   import { pushUndo, undo, redo } from '~/app/undo';
 *   doTheThing();
 *   pushUndo({ label: 'Delete image', undo: () => putItBack(), redo: () => doTheThing() });
 *
 * One stack per session (the current session when `pushUndo` runs), kept in memory only (closures).
 * Ctrl/⌘+Z = undo, Ctrl/⌘+Shift+Z and Ctrl+Y = redo, app-wide (`useUndoHotkeys`, mounted in App);
 * inside a text box they stay the browser's text undo. Undo / Redo buttons sit next to the logo
 * (`UndoButtons`). While an undo / redo runs, `pushUndo` is ignored, so an action may push itself
 * from shared code without doubling up. Cheap parameter changes pass a `mergeKey`: a drag is one entry.
 */
import { create } from 'zustand';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useSessions } from './sessionsStore';
import { emptyStack, popRedo, popUndo, pushEntry, type UndoAction, type UndoStack } from './undoLogic';

export type { UndoAction } from './undoLogic';

interface UndoState { stacks: Record<string, UndoStack> }

const useUndoStore = create<UndoState>(() => ({ stacks: {} }));

const EMPTY = emptyStack();
let applying = false;

function scope(): string {
  try { return useSessions.getState().currentId || 'app'; } catch { return 'app'; }
}

function stackOf(id = scope()): UndoStack {
  return useUndoStore.getState().stacks[id] ?? EMPTY;
}

function setStack(id: string, stack: UndoStack): void {
  useUndoStore.setState((s) => ({ stacks: { ...s.stacks, [id]: stack } }));
}

/** Record an action that already happened. Ignored while an undo / redo runs. */
export function pushUndo(action: UndoAction): void {
  if (applying) return;
  const id = scope();
  setStack(id, pushEntry(stackOf(id), action, Date.now()));
}

function run(fn: () => void): void {
  applying = true;
  try { fn(); } catch (e) { console.error('[undo]', e); } finally { applying = false; }
}

/**
 * Run `fn` without recording: any pushUndo inside it is ignored. For a caller that records ONE
 * entry of its own around setters that would record their own (reset to default, item 8).
 */
export function withoutUndo(fn: () => void): void {
  if (applying) { fn(); return; }
  run(fn);
}

/** Undo the last action of the current session. False when there was nothing to undo. */
export function undo(): boolean {
  const id = scope();
  const { stack, entry } = popUndo(stackOf(id));
  if (!entry) return false;
  setStack(id, stack);
  run(entry.undo);
  return true;
}

/** Redo the last undone action of the current session. */
export function redo(): boolean {
  const id = scope();
  const { stack, entry } = popRedo(stackOf(id));
  if (!entry) return false;
  setStack(id, stack);
  run(entry.redo);
  return true;
}

/** Forget a session's history (e.g. on "Reset session" / delete). Default: the current one. */
export function clearUndo(sessionId: string = scope()): void {
  setStack(sessionId, EMPTY);
}

/** The label of what Ctrl+Z would undo now ('' = nothing). A string, so selectors stay stable. */
export function useUndoLabel(): string {
  const id = useSessions((s) => s.currentId) || 'app';
  return useUndoStore((s) => { const p = s.stacks[id]?.past; return p?.length ? p[p.length - 1].label : ''; });
}

/** The label of what Ctrl+Shift+Z would redo now ('' = nothing). */
export function useRedoLabel(): string {
  const id = useSessions((s) => s.currentId) || 'app';
  return useUndoStore((s) => { const f = s.stacks[id]?.future; return f?.length ? f[f.length - 1].label : ''; });
}

/** Mount once (App): Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y. Never inside a text box (the browser's text undo). */
export function useUndoHotkeys(): void {
  useShortcut(['cmd+z'], (e) => {
    if (e.altKey) return false;
    e.preventDefault();
    undo();
  }, { priority: ShortcutPriority.Global });
  useShortcut(['cmd+shift+z', 'ctrl+y'], (e) => {
    if (e.altKey) return false;
    e.preventDefault();
    redo();
  }, { priority: ShortcutPriority.Global });
}
