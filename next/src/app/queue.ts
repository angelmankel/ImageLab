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
  const run = parseRunRowId(id);
  if (run) { void (run.source === 'video' ? useVideoRun : useWorkflowRun).getState().cancel(run.promptId); return; }
  useStore.getState().cancelJob(id);
}

/** Every running / queued job as rows (the hook below and `jobProgress.ts` share it). */
export function rowsOf(
  jobs: ReturnType<typeof useStore.getState>['jobs'],
  servers: ReturnType<typeof useStore.getState>['servers'],
  video: RunLike, workflow: RunLike, steps: readonly Step[],
): QueueRow[] {
  const imageStep = steps.find((s) => s.kind === 'image')?.id;
  const videoStep = steps.find((s) => s.kind === 'video')?.id;
  const workflowStep = steps.find((s) => s.kind === 'workflow')?.id;
  const out: QueueRow[] = [];
  for (const j of jobs) {
    const r = rowOfJob(j, servers.find((sv) => sv.id === j.serverId)?.name, imageStep);
    if (r) out.push(r);
  }
  out.push(...rowsOfRun('video', video, videoStep), ...rowsOfRun('workflow', workflow, workflowStep));
  return out.length ? orderRows(out) : NONE;
}

/** Live rows: the running job first, then the queue, oldest first. */
export function useQueue(): Queue {
  const jobs = useStore((s) => s.jobs);
  const servers = useStore((s) => s.servers);
  const video = useVideoRun((s) => s);
  const workflow = useWorkflowRun((s) => s);
  const steps = useSteps((s) => s.steps);

  const rows = useMemo(() => rowsOf(jobs, servers, video, workflow, steps), [jobs, servers, video, workflow, steps]);

  const running = rows.find((r) => r.status === 'running') ?? null;
  const queued = useMemo(() => rows.filter((r) => r.status === 'queued'), [rows]);
  return {
    rows, running, queued,
    cancel: cancelQueueRow,
    cancelAll: () => { for (const r of rows) cancelQueueRow(r.id); },
  };
}
