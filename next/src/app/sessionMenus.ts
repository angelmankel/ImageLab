/**
 * Right-click entries for sessions (fix list 36 / 45): a session tab ('tab': Duplicate · Close ·
 * Close others · Delete) and "New session from this" on a history picture ('history-image').
 * Imported once by App, which also boots `sessionsStore` (the migration + the steps mirror).
 */
import { IconCopy, IconLayoutGrid, IconSquarePlus, IconTrash, IconX } from '@tabler/icons-react';
import { registerMenu } from './contextMenu';
import { useRoute } from './routeStore';
import { newSessionFromImage, useSessions, type ImageLike, type Session } from './sessionsStore';

registerMenu<Session>('tab', [
  { id: 'dup', label: 'Duplicate', icon: IconCopy, group: 'edit', action: (s) => { useSessions.getState().duplicate(s.id); } },
  { id: 'home', label: 'All sessions', icon: IconLayoutGrid, group: 'edit', action: () => useRoute.getState().go('home') },
  {
    id: 'close', label: 'Close', icon: IconX, group: 'close', shortcut: 'Middle-click',
    enabled: () => useSessions.getState().openIds.length > 1 || 'The last tab stays open',
    action: (s) => { useSessions.getState().closeTab(s.id); },
  },
  {
    id: 'close-others', label: 'Close others', group: 'close',
    enabled: () => useSessions.getState().openIds.length > 1 || 'No other tabs',
    action: (s) => {
      const st = useSessions.getState();
      if (st.currentId !== s.id) st.switchTo(s.id);
      useSessions.setState({ openIds: [s.id] });
    },
  },
  {
    id: 'delete', label: 'Delete session', icon: IconTrash, danger: true, group: 'danger', order: 100,
    action: (s) => { useSessions.getState().remove(s.id); },
  },
]);

registerMenu<ImageLike & { kind?: string }>('history-image', [
  {
    id: 'new-session', label: 'New session from this', icon: IconSquarePlus, group: 'reuse', order: -1,
    action: (t) => { newSessionFromImage(t); },
  },
]);
