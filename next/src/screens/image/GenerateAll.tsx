/**
 * Fix list 17: "Generate all" — the button under "+ Add" in the rail runs EVERY step in order
 * (the Generate bar keeps running only the open step). Each step waits for the one above it to
 * finish, so it chains to that fresh output; each result is credited to the step that made it.
 *
 * It refuses a broken chain up front and says why (one line per broken step; the rail's red rings
 * show the same): a step missing a required field, or one that needs a picture and has none.
 * A step waiting on the step above is fine here (that step runs first). While it runs the button
 * shows "Step 2 / 4" and a click stops after the current step.
 *
 * Fix list 2 item 17: only the steps that are NOT up to date run (`~/app/stepFingerprint`, our own
 * fingerprint cache, so it works for any provider); an up-to-date step's output is reused. Each
 * step is judged when its turn comes, so a step whose step above just re-ran (new input) runs too.
 * Nothing out of date → nothing is queued, the button says "Up to date" for a moment.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { comfyHttpFor } from '@/lib/comfy';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { ownerOfStep, runAsOwner } from '~/app/outputs';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { objectInfoNow } from '@/features/studio/useStudioRun';
import { modeHostNow } from '@/features/workspace/modeHost';
import { useSteps, brokenChainMessage, STEP_LABEL, type Step } from '~/app/stepsStore';
import { enqueueRun } from '~/app/runQueue';
import { useSessions } from '~/app/sessionsStore';
import { stepWorkflowNow } from '~/screens/comfy';
import { Tip } from '~/ui/Tip';
import { stepProblemNow } from './useStepProblem';
import { stepFreshnessNow } from '~/app/stepFingerprint';
import { OWN_KINDS, runKindStep } from './kinds/kindRun';
import { IMAGE_STEP_ONLY } from './kinds/imageStepOnly';
import { trackRun } from './kinds/trackRun';
import { runVideoStep } from './video/videoChain';
import { startWorkflowStepRun } from './workflow';
import { notifyError, say } from '~/app/notify';

interface AllState {
  running: boolean;
  /** 1-based index of the step running now (0 = none yet). */
  at: number;
  total: number;
  stop: boolean;
  /** The step running now (the rail fills its ring; the steps after it that will run show a queued ring). */
  currentId: string | null;
  /** When a Generate all found every step up to date (the button says so for a moment). */
  upToDateAt: number;
}
const useAll = create<AllState>(() => ({ running: false, at: 0, total: 0, stop: false, currentId: null, upToDateAt: 0 }));

const note = (title: string, message: string) => notifyError(title, undefined, { hint: message });

/** Wait until the image jobs queued since `before` have all left the queue; their error if one failed. */
function waitImageJobs(before: Set<string>): Promise<string | null> {
  return new Promise((resolve) => {
    const mine = () => useStore.getState().jobs.filter((j) => !before.has(j.id));
    const check = () => {
      const jobs = mine();
      const failed = jobs.find((j) => j.status === 'error');
      if (failed) { done(failed.error ?? 'The image job failed'); return; }
      if (!jobs.some((j) => j.status === 'queued' || j.status === 'running')) done(null);
    };
    const unsub = useStore.subscribe(check);
    const done = (err: string | null) => { unsub(); resolve(err); };
    check();
  });
}

async function infoFor(host: string): Promise<ObjectInfo | null> {
  const cached = objectInfoNow(host);
  if (cached) return cached;
  try { const r = await fetch(`${comfyHttpFor(host)}/object_info`); return r.ok ? ((await r.json()) as ObjectInfo) : null; } catch { return null; }
}

/** Why Generate all stops when the session it started in is no longer the open one. */
const SWITCHED = 'Another session was opened — the steps read their settings from the open session, so it stopped here';

/** Run one step and wait for it to finish. null = done, else why it failed. */
async function runStepToEnd(step: Step, sessionId?: string): Promise<string | null> {
  if (step.kind === 'image') {
    const before = new Set(useStore.getState().jobs.map((j) => j.id));
    const owner = ownerOfStep(step.id);
    // The press waits its turn in the run queue: by then the user may have opened another session,
    // whose parameters the main store now holds — never queue those for this one.
    let moved = false;
    await enqueueRun(() => {
      if (sessionId && useSessions.getState().currentId !== sessionId) { moved = true; return undefined; }
      return owner ? runAsOwner(owner, () => fireFromStore(false, IMAGE_STEP_ONLY)) : fireFromStore(false, IMAGE_STEP_ONLY);
    });
    if (moved) return SWITCHED;
    const queued = useStore.getState().jobs.some((j) => !before.has(j.id));
    if (!queued) { const st = useStore.getState().status; return st.kind === 'error' ? st.text : 'The picture was not queued'; }
    return waitImageJobs(before);
  }
  if (OWN_KINDS.has(step.kind)) return runKindStep(step, false, true);
  if (step.kind === 'video') {
    const host = modeHostNow('video');
    if (!host) return 'No video server';
    if (useVideoRun.getState().busy) return 'A video is already rendering';
    const tracked = trackRun(useVideoRun, step.id);
    await runVideoStep(step, host, false);
    if (!tracked.started() && !useVideoRun.getState().busy) tracked.cancel(useVideoRun.getState().error ?? 'The video did not start');
    return tracked.done;
  }
  // Workflow.
  const host = stepWorkflowNow(step.id)?.host ?? modeHostNow('workflow');
  if (!host) return 'No server';
  if (useWorkflowRun.getState().busy) return 'The workflow runner is busy';
  const info = await infoFor(host);
  if (!info) return 'Could not read the server’s node list';
  const tracked = trackRun(useWorkflowRun, step.id);
  await startWorkflowStepRun(step, host, info, false);
  if (!tracked.started() && !useWorkflowRun.getState().busy) tracked.cancel(useWorkflowRun.getState().error ?? 'The workflow did not start');
  return tracked.done;
}

/** Run one step now (the step menu's "Run this step"), its error as a note. */
export async function runStepNow(step: Step): Promise<void> {
  const err = await runStepToEnd(step);
  if (err) note(`Step · ${STEP_LABEL[step.kind]}`, err);
}

/** Generate every step in order. Refuses (and says why) when the chain is broken. */
export async function generateAll(): Promise<void> {
  if (useAll.getState().running) { useAll.setState({ stop: true }); return; }
  const steps = useSteps.getState().steps;
  const refusal = brokenChainMessage(steps.map((s, index) => ({ index, kind: s.kind, problem: stepProblemNow(s, true) })));
  if (refusal) { note('Generate all: fix these first', refusal); return; }
  // Item 17: only the steps that are not up to date run; an up-to-date step's output is reused as it is.
  if (steps.every((s) => stepFreshnessNow(s.id)?.state === 'fresh')) { useAll.setState({ upToDateAt: Date.now() }); return; }
  useAll.setState({ running: true, at: 0, total: steps.length, stop: false, currentId: null });
  // Pinned to the session it started in: every step reads its settings from the OPEN session's
  // stores, so after a tab switch the rest would run with the other session's settings.
  const sessionId = useSessions.getState().currentId;
  let ran = 0;
  try {
    for (let i = 0; i < steps.length; i++) {
      if (useAll.getState().stop) { say(`Generate all stopped after step ${i}`); return; }
      if (useSessions.getState().currentId !== sessionId) { note(`Generate all stopped before step ${i + 1}`, SWITCHED); return; }
      // The step as it is now (an earlier step's run does not change it, but the user may have).
      const step = useSteps.getState().steps.find((s) => s.id === steps[i].id);
      if (!step) continue;
      // Judged now: a step above that just re-ran gave this one a new input, so it is stale by then.
      if (stepFreshnessNow(step.id)?.state === 'fresh') continue;
      useAll.setState({ at: i + 1, currentId: step.id });
      const err = await runStepToEnd(step, sessionId);
      if (err) { note(`Generate all stopped at step ${i + 1} · ${STEP_LABEL[step.kind]}`, err); return; }
      ran++;
    }
    say(ran === steps.length ? `All ${steps.length} steps done` : `${ran} out-of-date step${ran === 1 ? '' : 's'} re-run, ${steps.length - ran} reused`);
  } finally {
    useAll.setState({ running: false, at: 0, total: 0, stop: false, currentId: null });
  }
}

export function GenerateAllButton() {
  const { running, at, total, stop, upToDateAt } = useAll();
  const label = running ? (stop ? 'Stopping…' : `${at} / ${total}`) : 'All';
  const [, tick] = useState(0);
  const upToDate = !running && Date.now() - upToDateAt < 1800;
  useEffect(() => { if (!upToDate) return; const t = setTimeout(() => tick((n) => n + 1), 1850); return () => clearTimeout(t); }, [upToDate]);
  return (
    <Tip label={running ? 'Stop after this step' : 'Generate all'} position="right">
      <button type="button" aria-label={running ? 'Stop Generate all' : 'Generate all steps'} className="il-btn" onClick={() => void generateAll()}
        style={{ width: 72, border: 0, background: 'transparent', color: 'var(--il-fg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 0, marginTop: 10, cursor: 'pointer', flex: 'none' }}>
        <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', background: running ? 'var(--il-card-on)' : 'var(--il-ember)', color: running ? 'var(--il-ember-hi)' : 'var(--il-bg)' }}>
          {running ? <IconPlayerStop size={18} stroke={2.6} /> : <IconPlayerPlay size={18} stroke={2.6} />}
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{running ? label : upToDate ? 'Up to date' : 'Generate all'}</span>
      </button>
    </Tip>
  );
}

/** The run's state for other callers (the step menu, the phone dock). */
export const useGenerateAll = () => useAll((s) => s.running);

/** Which step Generate all is running now, and its 1-based index (the rail's rings). */
export const useGenerateAllAt = () => useAll((s) => (s.running ? s.at : 0));

/** The step Generate all is running now (null when it is not running). */
export const useGenerateAllCurrent = () => useAll((s) => (s.running ? s.currentId : null));
