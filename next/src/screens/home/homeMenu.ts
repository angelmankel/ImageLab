/** The 'session' right-click / ⋯ menu on a Home tile (fix list 20 / 45): Open · Rename · Duplicate · Delete (Ctrl+Z brings it back, fix list 2 #12: no toast). */
import { IconCopy, IconExternalLink, IconPencil, IconTrash } from '@tabler/icons-react';
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
    { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, action: (s) => deleteWithUndo(s.id) },
  ]);
}
