/**
 * Rule 15: the job queue, shared by the desktop "Queue N" pill (popover with ✕ per row) and the
 * phone (badge on Generate, list on the Output page, ✕ per row). Image jobs come from the main
 * store's `jobs` (cancel = `cancelJob`: interrupt when running, delete when queued); the video and
 * workflow runs from their run stores (cancel = the store's `cancel`). Rows are memoised so a
 * selector never hands React a fresh array for the same inputs.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useSteps, type Step } from './stepsStore';
import { runStepOf } from './runSteps';
import { jobOwner } from './outputs';
import { cancelComfyRow, useComfyJobs } from '~/screens/comfy/comfyJobs';
import { parseComfyRowId } from '~/screens/comfy/comfyJobsLogic';
import { orderRows, parseRunRowId, rowOfJob, rowsOfRun, type QueueRow, type RunLike } from './queueLogic';

export type { QueueRow } from './queueLogic';

const NONE: QueueRow[] = [];

export interface Queue {
  rows: QueueRow[];
  running: QueueRow | null;
  queued: QueueRow[];
  /** Cancel one row: running (interrupt) or queued (delete), image job or run. */
  cancel: (id: string) => void;
  /** Cancel everything that is running or waiting. */
  cancelAll: () => void;
}

/** Cancel by row id without a hook (the Generate button's Stop, the phone). */
export function cancelQueueRow(id: string): void {
  if (parseComfyRowId(id)) { void cancelComfyRow(id); return; }
  const run = parseRunRowId(id);
  if (run) { void (run.source === 'video' ? useVideoRun : useWorkflowRun).getState().cancel(run.promptId); return; }
  useStore.getState().cancelJob(id);
}

/** Every running / queued job as rows (the hook below and `jobProgress.ts` share it). */
export function rowsOf(
  jobs: ReturnType<typeof useStore.getState>['jobs'],
  servers: ReturnType<typeof useStore.getState>['servers'],
  video: RunLike, workflow: RunLike, steps: readonly Step[],
  /** Prompts queued inside ComfyUI itself (FIXLIST-2 #51, `useComfyJobs`). */
  comfy: readonly QueueRow[] = NONE,
): QueueRow[] {
  const imageStep = steps.find((s) => s.kind === 'image')?.id;
  const videoStep = steps.find((s) => s.kind === 'video')?.id;
  const workflowStep = steps.find((s) => s.kind === 'workflow')?.id;
  const out: QueueRow[] = [];
  for (const j of jobs) {
    const r = rowOfJob(j, servers.find((sv) => sv.id === j.serverId)?.name, imageStep);
    if (r) out.push(r);
  }
  out.push(...rowsOfRun('video', video, videoStep, runStepOf), ...rowsOfRun('workflow', workflow, workflowStep, runStepOf));
  // Every row says which session (and step) queued it, so its tab can show it running (fix list 2, item 15).
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    const owner = jobOwner(parseRunRowId(r.id)?.promptId ?? (r.source === 'image' ? r.id : undefined));
    if (owner) out[i] = { ...r, sessionId: owner.sessionId, stepId: owner.stepId || r.stepId };
  }
  // Prompts queued inside ComfyUI itself (FIXLIST-2 #51): no session / step of ours.
  out.push(...comfy);
  return out.length ? orderRows(out) : NONE;
}

/** Live rows: the running job first, then the queue, oldest first. */
export function useQueue(): Queue {
  const jobs = useStore((s) => s.jobs);
  const servers = useStore((s) => s.servers);
  const video = useVideoRun((s) => s);
  const workflow = useWorkflowRun((s) => s);
  const steps = useSteps((s) => s.steps);
  const comfy = useComfyJobs((s) => s.rows);

  const rows = useMemo(() => rowsOf(jobs, servers, video, workflow, steps, comfy), [jobs, servers, video, workflow, steps, comfy]);

  // A step's Generate / progress follows our own jobs; ComfyUI's own prompts only list (FIXLIST-2 #51).
  const running = rows.find((r) => r.status === 'running' && r.source !== 'comfy') ?? null;
  const queued = useMemo(() => rows.filter((r) => r.status === 'queued'), [rows]);
  return {
    rows, running, queued,
    cancel: cancelQueueRow,
    cancelAll: () => { for (const r of rows) cancelQueueRow(r.id); },
  };
}
