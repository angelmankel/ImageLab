/**
 * Item 43 (toolbar part): one click removes the background of the shown picture. Runs
 * `removeBackgroundRun` (~/app/removeBg) on the picture's server and adds the cut-out to the
 * history as a new entry (the source's prompt / settings ride along, `derivedFrom` names the
 * source), selected so it shows on the stage at once, over a checkerboard. Used by the canvas
 * toolbar, the canvas / history right-click menus and the viewer. Plain functions + a tiny store
 * for the busy state (one run per picture at a time).
 */
import { create } from 'zustand';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import type { HistoryEntry } from '@/lib/types';
import { useStage } from '~/screens/image/stageStore';
import { removeBackgroundRun } from './removeBg';
import { notifyError, say, unsay } from './notify';

interface RemoveBgState { busy: Record<string, true>; set: (url: string, on: boolean) => void }

const NONE: Record<string, true> = Object.freeze({}) as Record<string, true>;

export const useRemoveBg = create<RemoveBgState>((set) => ({
  busy: NONE,
  set: (url, on) => set((s) => {
    const busy = { ...s.busy };
    if (on) busy[url] = true; else delete busy[url];
    return { busy: Object.keys(busy).length ? busy : NONE };
  }),
}));

/** Is a Remove BG running for this picture? (a hook: re-renders when it starts / ends) */
export const useRemovingBg = (url: string | null | undefined) => useRemoveBg((s) => !!url && !!s.busy[url]);

export async function removeBgFrom(src: { url: string; filename: string; entry?: HistoryEntry | null }): Promise<HistoryEntry | null> {
  const { url, filename, entry } = src;
  if (useRemoveBg.getState().busy[url]) return null;
  useRemoveBg.getState().set(url, true);
  say('Removing the background…', { tone: 'busy' });
  const started = Date.now();
  try {
    const res = await removeBackgroundRun(url, filename);
    const st = useStore.getState();
    const serverId = res.serverId ?? entry?.serverId ?? '';
    const made: HistoryEntry = {
      id: uid(),
      serverId,
      filename: res.image.filename,
      subfolder: res.image.subfolder,
      type: res.image.type || 'output',
      promptId: res.promptId,
      positive: entry?.positive ?? '',
      negative: entry?.negative ?? '',
      seed: entry?.seed ?? 0,
      model: entry?.model ?? '',
      createdAt: Date.now(),
      durationMs: Date.now() - started,
      ...(entry?.workflow ? { workflow: entry.workflow } : {}),
      ...(entry?.layers ? { layers: entry.layers } : {}),
      ...(entry ? { derivedFrom: { id: entry.id, op: 'removebg' } } : {}),
    };
    const stamped = st.pushHistory(made);
    st.selectHistoryEntry(stamped);
    useStage.getState().showRun(null);
    say('Background removed');
    return stamped;
  } catch (e) {
    unsay();
    notifyError('Remove background failed', e);
    return null;
  } finally {
    useRemoveBg.getState().set(url, false);
  }
}
