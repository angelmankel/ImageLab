/**
 * Fix list 2, item 15: each session keeps its own "what the stage shows". The main store has ONE
 * `selectedEntry` (and `useStage` one `runKey`); this module remembers them per session:
 *  - a picture another session's job selects when it lands (the main store frames a finished
 *    job) is filed under THAT session and the open session's pick is put back, so a job of A never
 *    changes B's canvas;
 *  - switching sessions brings back that session's own pick (or none: its newest output);
 *  - a job that ENDS makes its first picture its session's current one — always, the open session
 *    or not, whatever was picked during the run, Auto-frame setting or not (fix list 2, ADDED after
 *    close). Its output may land just before or just after the job leaves the queue, so the job
 *    waits here (`awaiting`, up to a minute) until it is there (`landedPick`, tested).
 * Side-effect module, imported by App (always mounted, never only with a canvas); memory only.
 */
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useSessions } from './sessionsStore';
import { jobOwner, sessionOfOutput } from './outputs';
import { useStage } from '~/screens/image/stageStore';
import { endedJobs, landedPick, type LandedPick } from './sessionPickLogic';

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

// ---------------------------------------------------------------------------------------------
// A finished job's first picture becomes its session's current picture.

const AWAIT_MS = 60_000;
const awaiting = new Map<string, { sessionId: string; at: number }>();

function applyPick(sessionId: string, p: LandedPick): void {
  const pk = pickOf(sessionId);
  if (p.kind === 'entry') { pk.entryId = p.key; pk.runKey = null; } else pk.runKey = p.key;
  if (sessionId !== useSessions.getState().currentId) return;
  reverting = true;
  try {
    if (p.kind === 'entry') {
      const e = useStore.getState().history.find((h) => h.id === p.key);
      if (e) useStore.setState({ selectedEntry: e });
      useStage.setState({ runKey: null });
    } else useStage.setState({ runKey: p.key });
  } finally { reverting = false; }
}

function settle(): void {
  if (!awaiting.size) return;
  const now = Date.now();
  const history = useStore.getState().history;
  const runs = [useWorkflowRun.getState().results, useVideoRun.getState().results];
  for (const [id, w] of [...awaiting]) {
    const p = landedPick(id, history, runs);
    if (p) { awaiting.delete(id); applyPick(w.sessionId, p); }
    else if (now - w.at > AWAIT_MS) awaiting.delete(id);
  }
}

function noteEnded(ids: readonly string[]): void {
  if (!ids.length) return;
  const cur = useSessions.getState().currentId;
  for (const id of ids) awaiting.set(id, { sessionId: jobOwner(id)?.sessionId ?? cur, at: Date.now() });
  settle();
}

useStore.subscribe((st, prev) => {
  if (st.jobs !== prev.jobs) noteEnded(endedJobs(prev.jobs.map((j) => j.id), st.jobs.map((j) => j.id)));
  if (st.history !== prev.history) settle();
});
for (const run of [useWorkflowRun, useVideoRun]) {
  run.subscribe((st, prev) => {
    if (st.jobs !== prev.jobs) noteEnded(endedJobs(prev.jobs.map((j) => j.promptId), st.jobs.map((j) => j.promptId)));
    if (st.results !== prev.results) settle();
  });
}
