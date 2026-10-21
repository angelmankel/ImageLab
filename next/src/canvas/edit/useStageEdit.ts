/**
 * Item 13: the stage's side of Edit mode. E toggles it on the shown picture (images only, not a
 * live frame); while it is on, a new pick in the history moves the session along when nothing is
 * edited yet (`followSource`).
 * Leaving the stage (another screen) keeps a session with unsaved edits; a clean one just ends.
 */
import { useEffect } from 'react';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import type { StageMedia } from '~/screens/image/useStageMedia';
import { exitEdit, followSource, isDirty, toggleEdit, useEdit, type EditSource } from './editStore';

export function editSourceOf(media: StageMedia): EditSource | null {
  const it = media.item;
  if (!it || it.kind !== 'image') return null;
  return { url: it.url, filename: it.filename, entry: media.source === 'image' ? media.entry : null };
}

export function useStageEdit(media: StageMedia, enabled: () => boolean) {
  const on = useEdit((s) => s.on);
  const url = media.item?.kind === 'image' ? media.item.url : null;

  useShortcut('e', () => { toggleEdit(editSourceOf(media)); }, { priority: ShortcutPriority.Panel + 10, when: () => enabled() && (useEdit.getState().on || !!editSourceOf(media)) });
  useEffect(() => { if (on) followSource(editSourceOf(media)); }, [on, url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (!isDirty()) exitEdit(true); }, []);

  return { editing: on };
}
