/**
 * Fix list 2, item 9: "Reset session" and "Clear all history" for one session. Both ask first
 * (Donny: "clear all history should ask you before confirming") and both go on the undo stack
 * (`~/app/undo`, Ctrl+Z). Clearing is session only: the outputs leave the session (`detachOutputs`),
 * the files stay on the server and in the History page (a server-side output store comes later).
 * Reset = clear + the steps back to ONE empty Image step + default parameters (`freshParams`).
 */
import { modals } from '@mantine/modals';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import { T } from '~/theme/tokens';
import { detachOutputs, restoreOwners, sessionOutputKeysNow } from './outputs';
import { displayName, freshParams, liveParams, loadParams, useSessions, type Session } from './sessionsStore';
import { makeSession } from './sessionsLogic';
import { useSteps } from './stepsStore';
import { pushUndo } from './undo';
import { useStage } from '~/screens/image/stageStore';

const isCurrent = (id: string) => useSessions.getState().currentId === id;

/** Take every output out of the session. Returns its undo, or null when there was nothing. */
export function clearSessionHistory(id: string): (() => void) | null {
  const keys = sessionOutputKeysNow(id);
  if (!keys.length) return null;
  const prev = detachOutputs(keys);
  if (isCurrent(id)) { useStage.getState().showRun(null); useStore.getState().selectHistoryEntry(null); }
  return () => restoreOwners(prev);
}

/** Steps, parameters and outputs back to a fresh session (the name stays). Returns its undo. */
export function resetSession(id: string): (() => void) | null {
  const st = useSessions.getState();
  const before: Session | undefined = st.sessions[id];
  if (!before) return null;
  const current = isCurrent(id);
  const params = current ? liveParams() : { image: before.image ?? null, video: before.video ?? null };
  const unclear = clearSessionHistory(id);
  const blank = makeSession(id, `step-${uid()}`, Date.now());
  const fresh = freshParams();
  if (current) {
    useSteps.setState({ steps: blank.steps, activeId: blank.activeId });
    loadParams(fresh.image, fresh.video);
  } else {
    useSessions.setState((s) => ({ sessions: { ...s.sessions, [id]: { ...before, steps: blank.steps, activeId: blank.activeId, image: fresh.image, video: fresh.video, updatedAt: Date.now() } } }));
  }
  return () => {
    unclear?.();
    if (isCurrent(id)) {
      useSteps.setState({ steps: before.steps, activeId: before.activeId });
      loadParams(params.image, params.video);
    } else {
      useSessions.setState((s) => (s.sessions[id] ? { sessions: { ...s.sessions, [id]: { ...s.sessions[id], steps: before.steps, activeId: before.activeId, image: params.image, video: params.video } } } : s));
    }
  };
}

function ask(title: string, body: string, confirm: string, onConfirm: () => void): void {
  modals.openConfirmModal({
    title,
    children: <span style={{ fontSize: 13, color: 'var(--il-fg2)' }}>{body}</span>,
    labels: { confirm, cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: T.z.confirm,
    centered: true,
    onConfirm,
  });
}

/** Ask, then clear the session's history (Ctrl+Z brings it back). */
export function confirmClearHistory(id: string = useSessions.getState().currentId): void {
  const n = sessionOutputKeysNow(id).length;
  const name = displayName(useSessions.getState().sessions[id]?.name);
  if (!n) return;
  ask('Clear all history?', `${n} ${n === 1 ? 'output leaves' : 'outputs leave'} “${name}”. The files stay on the server and in the History page.`, 'Clear history', () => {
    const undo = clearSessionHistory(id);
    if (undo) pushUndo({ label: 'Clear history', undo, redo: () => { clearSessionHistory(id); } });
  });
}

/** Ask, then reset the session (Ctrl+Z brings it back). */
export function confirmResetSession(id: string = useSessions.getState().currentId): void {
  const name = displayName(useSessions.getState().sessions[id]?.name);
  ask('Reset session?', `“${name}” goes back to a fresh session: one empty Image step, default settings, no history. The files stay on the server.`, 'Reset', () => {
    let undo = resetSession(id);
    if (undo) pushUndo({ label: 'Reset session', undo: () => undo?.(), redo: () => { undo = resetSession(id); } });
  });
}
