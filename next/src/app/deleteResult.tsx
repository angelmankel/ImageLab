/**
 * Delete an output (Donny 10-20: "need a way to delete outputs"), from the history tiles, the stage
 * toolbar, the Delete / Backspace key, the viewer, the phone Output page and the History page.
 * No confirm, no toast: Ctrl+Z (the app's undo stack, `~/app/undo`) brings it back.
 *
 * Images leave the image history (`removeHistoryEntry`); the file stays on the server, as do
 * starred copies. Fix list 2, item 2 ("deleted images come back"): the image history keeps only
 * its own entries, but the workflow run store loads EVERY finished prompt from the server's
 * `/history` that is not an image job — and a prompt stops counting as an image job once its
 * entry is gone. So a deleted image came back on the next reload as a "workflow" result. Every
 * delete now also hides the file in both run stores (`hideUrls`, persisted, matched by file —
 * not by host — in `@/lib/hiddenResults`), so it stays gone. Video / workflow results leave their
 * run store the same way (`removeResult`).
 */
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfyHost';
import type { HistoryEntry } from '@/lib/types';
import type { RunStore } from '@/lib/comfyRunner';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useStage } from '~/screens/image/stageStore';
import { pushUndo } from './undo';
import { ownerCtxNow, sessionOf } from './outputs';
import { useSessions } from './sessionsStore';

const RUN_STORES: RunStore[] = [useVideoRun, useWorkflowRun];

/** The image's file as a url (any host does: hidden urls match by file). */
function urlOf(entry: HistoryEntry): string | null {
  const host = useStore.getState().servers.find((s) => s.id === entry.serverId)?.host;
  return host ? viewUrl(entry, host) : null;
}

/** Take an image out of the history for good (no undo entry): the history entry, and its file in the run stores. */
export function forgetImage(entry: HistoryEntry): void {
  useStore.getState().removeHistoryEntry(entry.id);
  const url = urlOf(entry);
  if (url) for (const st of RUN_STORES) st.getState().hideUrls([url]);
}

/** Undo of `forgetImage`. */
function unforgetImage(entry: HistoryEntry, index: number, select: boolean): void {
  const url = urlOf(entry);
  if (url) for (const st of RUN_STORES) st.getState().unhideUrls([url]);
  useStore.getState().restoreHistoryEntry(entry, index, select);
}

/** An image result: out of the history, back at its place on Ctrl+Z (shown again if it was shown). */
export function deleteImage(entry: HistoryEntry): void {
  const st = useStore.getState();
  const index = st.history.findIndex((h) => h.id === entry.id);
  if (index < 0) return;
  // The neighbour that slides in comes from the same session (fix list 2, item 9).
  const ctx = ownerCtxNow();
  const cur = useSessions.getState().currentId;
  const mine = st.history.filter((h) => h.id === entry.id || sessionOf(h.id, ctx) === cur);
  const at = mine.findIndex((h) => h.id === entry.id);
  const shown = st.selectedEntry?.id === entry.id || (!st.selectedEntry && at === 0);
  const neighbour = mine[at + 1] ?? mine[at - 1] ?? null;
  forgetImage(entry);
  if (shown) useStore.getState().selectHistoryEntry(neighbour);
  pushUndo({ label: 'Delete image', undo: () => unforgetImage(entry, index, shown), redo: () => deleteImage(entry) });
}

/** The run store a result url belongs to, or null. */
export function runStoreOf(url: string): RunStore | null {
  for (const store of RUN_STORES) if (store.getState().results.some((r) => r.url === url)) return store;
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
  // The same file in the other store (a still that both lists picked up) goes too.
  for (const other of RUN_STORES) if (other !== store) other.getState().hideUrls([url]);
  pushUndo({
    label: 'Delete',
    undo: () => {
      for (const other of RUN_STORES) if (other !== store) other.getState().unhideUrls([url]);
      store.getState().restoreResult(result, index);
      if (shown) useStage.getState().showRun(url);
    },
    redo: () => deleteRun(url),
  });
}

/** Whatever a tile / the stage holds: the history entry when it has one, else the run result by url. */
export function deleteOutput(target: { entry?: HistoryEntry | null; url: string }): void {
  if (target.entry) deleteImage(target.entry);
  else deleteRun(target.url);
}
