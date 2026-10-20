/**
 * Rule 6: what a tap on a snippet does, on the main store. Toggle = the old chip rule (a preset
 * with `layers` is always inserted whole; a plain snippet goes in as a layer or every layer it
 * made comes out), with `touchSnippet` kept for the main app's recents. Delete offers Undo that
 * puts the snippet back where it was and re-links its layers.
 */
import { useMemo } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import type { LayerKind, Snippet } from '@/lib/types';
import { applyPromptPreset } from '@/lib/promptPresets';
import { uid } from '@/lib/storage';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { indexOfId, inPromptIds, insertAt } from './snippetLogic';

/** The set of snippet ids with a part in the prompt (memoised on the layers array). */
export function useInPrompt(): Set<string> {
  const layers = useStore((s) => s.layers);
  return useMemo(() => inPromptIds(layers), [layers]);
}

export function toggleSnippet(s: Snippet, inPrompt: boolean) {
  const st = useStore.getState();
  useWorkspace.getState().touchSnippet(s.id);
  if (s.layers) { st.setPromptLayers(applyPromptPreset(st.layers, s, 'insert', uid)); return; }
  if (inPrompt) st.removeLayersFromSnippet(s.id); else st.insertSnippetAsLayer(s.id);
}

/** Take every part of the snippet out of the prompt (the × on the "In prompt" strip). */
export function removeFromPrompt(id: string) {
  useStore.getState().removeLayersFromSnippet(id);
}

/** Save a new snippet to the library and put it in the prompt. Returns its id. */
export function addAndInsert(input: { name: string; text: string; kind: LayerKind; categoryId: string }): string {
  const st = useStore.getState();
  const id = st.addSnippet({ name: input.name.trim(), text: input.text.trim(), kind: input.kind, categoryId: input.categoryId, tag: '', weight: 1 });
  st.insertSnippetAsLayer(id);
  useWorkspace.getState().touchSnippet(id);
  return id;
}

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
