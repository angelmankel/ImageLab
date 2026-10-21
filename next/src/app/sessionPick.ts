/**
 * Fix list 2, item 15: each session keeps its own "what the stage shows". The main store has ONE
 * `selectedEntry` (and `useStage` one `runKey`); this module remembers them per session:
 *  - a picture another session's job selects when it lands (the main store frames a finished
 *    job) is filed under THAT session and the open session's pick is put back, so a job of A never
 *    changes B's canvas;
 *  - switching sessions brings back that session's own pick (or none: its newest output).
 * Side-effect module (imported by `useStageMedia`); memory only.
 */
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { useSessions } from './sessionsStore';
import { jobOwner, sessionOfOutput } from './outputs';
import { useStage } from '~/screens/image/stageStore';

interface Pick { entryId: string | null; runKey: string | null }
const picks: Record<string, Pick> = {};
let reverting = false;

const pickOf = (id: string): Pick => (picks[id] ??= { entryId: null, runKey: null });

/** Whose picture is this: its owner record, else the job that made it (a fresh one is credited a moment later). */
function ownerOf(e: HistoryEntry): string | null {
  return jobOwner(e.promptId)?.sessionId ?? sessionOfOutput(e.id);
}

useStore.subscribe((st, prev) => {
  if (reverting || st.selectedEntry === prev.selectedEntry) return;
  const cur = useSessions.getState().currentId;
  const e = st.selectedEntry;
  if (!e) { pickOf(cur).entryId = null; return; }
  const owner = ownerOf(e);
  if (owner && owner !== cur) {
    pickOf(owner).entryId = e.id;
    // Put the open session's pick back (unless it is gone: a delete moved off it).
    const back = prev.selectedEntry && st.history.some((h) => h.id === prev.selectedEntry!.id) ? prev.selectedEntry : null;
    reverting = true;
    try { useStore.setState({ selectedEntry: back }); } finally { reverting = false; }
    return;
  }
  pickOf(cur).entryId = e.id;
});

useStage.subscribe((st, prev) => {
  if (reverting || st.runKey === prev.runKey) return;
  pickOf(useSessions.getState().currentId).runKey = st.runKey;
});

useSessions.subscribe((st, prev) => {
  if (st.currentId === prev.currentId) return;
  const p = pickOf(st.currentId);
  const entry = p.entryId ? useStore.getState().history.find((h) => h.id === p.entryId) ?? null : null;
  reverting = true;
  try {
    useStore.setState({ selectedEntry: entry });
    useStage.setState({ runKey: p.runKey });
  } finally { reverting = false; }
});
