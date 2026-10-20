/** "<what> · Undo" note for menu actions, closing in 3 s (Donny's toast rule). */
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';

let seq = 0;
export function undoNote(what: string, onUndo: () => void): void {
  const id = `il-menu-undo-${++seq}`;
  notifications.show({
    id,
    autoClose: 3000,
    message: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        {what}<span aria-hidden style={{ color: 'var(--il-muted)' }}>·</span>
        <Button size="compact-xs" variant="light" onClick={() => { onUndo(); notifications.hide(id); }}>Undo</Button>
      </span>
    ),
  });
}
