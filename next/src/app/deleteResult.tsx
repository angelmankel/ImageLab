/**
 * Delete an output (Donny 10-20: "need a way to delete outputs"), from the history tiles, the stage
 * toolbar, the Delete / Backspace key and the phone Output page. No confirm: every delete shows
 * "Deleted · Undo". Images do what the classic app's Delete does — the entry leaves the history
 * (`removeHistoryEntry`, which shows a neighbour); the file stays on the server, as do starred
 * copies. Video / workflow results leave their run store (`removeResult`, remembered so a
 * `/history` reload does not bring them back). Plain functions, callable from any handler.
 */
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import type { RunStore } from '@/lib/comfyRunner';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useStage } from '~/screens/image/stageStore';

let seq = 0;

function deletedNote(onUndo: () => void) {
  const id = `il-deleted-${++seq}`;
  notifications.show({
    id,
    autoClose: 6000,
    message: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        Deleted<span aria-hidden style={{ color: 'var(--il-muted)' }}>·</span>
        <Button size="compact-xs" variant="light" onClick={() => { onUndo(); notifications.hide(id); }}>Undo</Button>
      </span>
    ),
  });
}

/** An image result: out of the history, back at its place on Undo (shown again if it was shown). */
export function deleteImage(entry: HistoryEntry): void {
  const st = useStore.getState();
  const index = st.history.findIndex((h) => h.id === entry.id);
  if (index < 0) return;
  const shown = (st.selectedEntry ?? st.history[0])?.id === entry.id;
  st.removeHistoryEntry(entry.id);
  deletedNote(() => useStore.getState().restoreHistoryEntry(entry, index, shown));
}

/** The run store a result url belongs to, or null. */
export function runStoreOf(url: string): RunStore | null {
  for (const store of [useVideoRun, useWorkflowRun]) if (store.getState().results.some((r) => r.url === url)) return store;
  return null;
}

/** A video / workflow result: out of its run store; the stage moves to a neighbour when it showed it. */
export function deleteRun(url: string): void {
  const store = runStoreOf(url);
  if (!store) return;
  const results = store.getState().results;
  const index = results.findIndex((r) => r.url === url);
  const result = results[index];
  const stage = useStage.getState();
  const shown = stage.runKey === url;
  if (shown) stage.showRun((results[index + 1] ?? results[index - 1])?.url ?? null);
  store.getState().removeResult(url);
  deletedNote(() => {
    store.getState().restoreResult(result, index);
    if (shown) useStage.getState().showRun(url);
  });
}

/** Whatever a tile / the stage holds: the history entry when it has one, else the run result by url. */
export function deleteOutput(target: { entry?: HistoryEntry | null; url: string }): void {
  if (target.entry) deleteImage(target.entry);
  else deleteRun(target.url);
}
