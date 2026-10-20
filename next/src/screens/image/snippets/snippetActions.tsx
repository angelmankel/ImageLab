/**
 * Items 12 + 13: deleting a snippet / tile, with Undo that puts it back where it was and re-links
 * any layers that pointed at it. (Toggling is now a text edit: `prompt/promptSections`.)
 */
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import type { Snippet } from '@/lib/types';
import { indexOfId, insertAt } from './snippetLogic';

/** Delete with Undo: the snippet goes back to its place and its layers point at it again. */
export function deleteWithUndo(s: Snippet) {
  const st = useStore.getState();
  const index = indexOfId(st.snippets, s.id);
  const linked = new Set(st.layers.filter((l) => l.originSnippetId === s.id).map((l) => l.id));
  st.removeSnippet(s.id);
  const noteId = `snippet-undo-${s.id}`;
  const restore = () => {
    const now = useStore.getState();
    if (indexOfId(now.snippets, s.id) >= 0) return;
    useStore.setState({ snippets: insertAt(now.snippets, index, s) });
    if (linked.size) now.setPromptLayers(now.layers.map((l) => (linked.has(l.id) ? { ...l, originSnippetId: s.id } : l)));
    notifications.hide(noteId);
  };
  notifications.show({
    id: noteId,
    title: `Deleted "${s.name}"`,
    message: <Button size="compact-xs" variant="light" mt={4} onClick={restore}>Undo</Button>,
    autoClose: 3000,
  });
}
