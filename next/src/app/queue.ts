/**
 * Rule 15: the job queue, shared by the desktop "Queue N" pill (popover with ✕ per row) and the
 * phone (badge on Generate, list on the Output page, ✕ per row). Owner: the Shell + Image step
 * agent (wires it to the main store's `jobs` / `cancelJob` and the comfy runner stores). Until
 * then this reads the main store directly so the shape is real.
 */
import { useStore } from '@/lib/store';
import type { Job } from '@/lib/types';

export interface QueueRow {
  id: string;
  /** Which step queued it (step id) when known. */
  stepId?: string;
  label: string;
  status: 'running' | 'queued' | 'done' | 'error';
  /** 0..1 while running. */
  progress?: number;
  startedAt?: number;
}

export function rowOfJob(j: Job): QueueRow {
  const status = (j as unknown as { status?: string }).status;
  return {
    id: j.id,
    label: (j as unknown as { label?: string }).label ?? 'Image',
    status: status === 'running' ? 'running' : status === 'done' || status === 'completed' ? 'done' : status === 'error' || status === 'failed' ? 'error' : 'queued',
    progress: (j as unknown as { progress?: number }).progress,
  };
}

const EMPTY: Job[] = [];

/** Live rows: the running job first, then the queue, oldest first. */
export function useQueue(): { rows: QueueRow[]; running: QueueRow | null; queued: QueueRow[]; cancel: (id: string) => void } {
  const jobs = useStore((s) => s.jobs ?? EMPTY);
  const cancel = useStore((s) => s.cancelJob);
  const rows = jobs.map(rowOfJob).filter((r) => r.status === 'running' || r.status === 'queued');
  const running = rows.find((r) => r.status === 'running') ?? null;
  const queued = rows.filter((r) => r.status === 'queued');
  return { rows, running, queued, cancel };
}
