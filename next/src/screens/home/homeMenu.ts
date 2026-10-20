/** The 'session' right-click / ⋯ menu on a Home tile (fix list 20 / 45): Open · Rename · Duplicate · Delete (Undo). */
import { IconCopy, IconExternalLink, IconPencil, IconTrash } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import { useRoute } from '~/app/routeStore';
import { deleteSession, useSessions, type Session } from '~/app/sessionsStore';

let done = false;
export function registerHomeMenu(): void {
  if (done) return;
  done = true;
  registerMenu<Session>('session', [
    { id: 'open', label: 'Open', icon: IconExternalLink, group: 'open', action: (s) => { useSessions.getState().open(s.id); useRoute.getState().go('step'); } },
    { id: 'rename', label: 'Rename', icon: IconPencil, group: 'edit', action: (s) => { void import('./HomeScreen').then((m) => m.useHomeUi.getState().setRenaming(s.id)); } },
    { id: 'dup', label: 'Duplicate', icon: IconCopy, group: 'edit', action: (s) => { useSessions.getState().duplicate(s.id); useRoute.getState().go('home'); } },
    { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, action: (s) => { void deleteSession(s.id); } },
  ]);
}
