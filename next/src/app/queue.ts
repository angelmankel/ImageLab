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
import { useSteps } from './stepsStore';
import { orderRows, rowOfJob, rowOfRun, type QueueRow } from './queueLogic';

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
  if (id === 'video-run') { void useVideoRun.getState().cancel(); return; }
  if (id === 'workflow-run') { void useWorkflowRun.getState().cancel(); return; }
  useStore.getState().cancelJob(id);
}

/** Live rows: the running job first, then the queue, oldest first. */
export function useQueue(): Queue {
  const jobs = useStore((s) => s.jobs);
  const servers = useStore((s) => s.servers);
  const video = useVideoRun((s) => s);
  const workflow = useWorkflowRun((s) => s);
  const steps = useSteps((s) => s.steps);

  const rows = useMemo(() => {
    const imageStep = steps.find((s) => s.kind === 'image')?.id;
    const videoStep = steps.find((s) => s.kind === 'video')?.id;
    const workflowStep = steps.find((s) => s.kind === 'workflow')?.id;
    const out: QueueRow[] = [];
    for (const j of jobs) {
      const r = rowOfJob(j, servers.find((sv) => sv.id === j.serverId)?.name, imageStep);
      if (r) out.push(r);
    }
    const v = rowOfRun('video', video, videoStep);
    if (v) out.push(v);
    const w = rowOfRun('workflow', workflow, workflowStep);
    if (w) out.push(w);
    return out.length ? orderRows(out) : NONE;
  }, [jobs, servers, video, workflow, steps]);

  const running = rows.find((r) => r.status === 'running') ?? null;
  const queued = useMemo(() => rows.filter((r) => r.status === 'queued'), [rows]);
  return {
    rows, running, queued,
    cancel: cancelQueueRow,
    cancelAll: () => { for (const r of rows) cancelQueueRow(r.id); },
  };
}
