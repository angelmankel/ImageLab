/** The 'session' right-click / ⋯ menu on a Home tile (fix list 20 / 45): Open · Rename · Duplicate · Clear history · Reset · Delete (Ctrl+Z brings it back, fix list 2 #12: no toast). */
import { IconCopy, IconEraser, IconExternalLink, IconPencil, IconRestore, IconTrash } from '@tabler/icons-react';
import { confirmClearHistory, confirmResetSession } from '~/app/sessionActions';
import { registerMenu } from '~/app/contextMenu';
import { useRoute } from '~/app/routeStore';
import { useSessions, type Session } from '~/app/sessionsStore';
import { pushUndo } from '~/app/undo';

function deleteWithUndo(id: string): void {
  const gone = useSessions.getState().remove(id);
  if (!gone) return;
  pushUndo({ label: 'Delete session', undo: () => useSessions.getState().restore(gone), redo: () => { useSessions.getState().remove(gone.id); } });
}

let done = false;
export function registerHomeMenu(): void {
  if (done) return;
  done = true;
  registerMenu<Session>('session', [
    { id: 'open', label: 'Open', icon: IconExternalLink, group: 'open', action: (s) => { useSessions.getState().open(s.id); useRoute.getState().go('step'); } },
    { id: 'rename', label: 'Rename', icon: IconPencil, group: 'edit', action: (s) => { void import('./HomeScreen').then((m) => m.useHomeUi.getState().setRenaming(s.id)); } },
    { id: 'dup', label: 'Duplicate', icon: IconCopy, group: 'edit', action: (s) => { useSessions.getState().duplicate(s.id); useRoute.getState().go('home'); } },
    { id: 'clear-history', label: 'Clear history…', icon: IconEraser, group: 'reset', action: (s) => confirmClearHistory(s.id) },
    { id: 'reset', label: 'Reset session…', icon: IconRestore, group: 'reset', action: (s) => confirmResetSession(s.id) },
    { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, action: (s) => deleteWithUndo(s.id) },
  ]);
}
