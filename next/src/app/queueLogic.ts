/**
 * Rule 15, the pure part: every running or queued job as one row shape, image jobs and the video /
 * workflow runs alike, running first then queued oldest first. Tested in tests/queue.test.cjs.
 */
export interface QueueRow {
  id: string;
  /** Which step queued it (step id) when known. */
  stepId?: string;
  /** 'image' = a generate-store job; 'video' / 'workflow' = that run store's one run. */
  source: 'image' | 'video' | 'workflow';
  label: string;
  status: 'running' | 'queued';
  /** 0..1 while running. */
  progress?: number;
  startedAt?: number;
  /** A short second line: the server, the node. */
  detail?: string;
}

export interface JobLike {
  id: string;
  status: string;
  createdAt: number;
  progress?: { value: number; max: number };
  node?: string;
  serverId: string;
  positive?: string;
}

export interface RunLike {
  busy: boolean;
  status: string | null;
  progress: number | null;
  currentNode: string | null;
  startedAt: number | null;
  /** Jobs waiting on that server (other clients' too). */
  queueRemaining: number;
}

const short = (text: string | undefined, n = 48) => {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || 'Image';
};

export function rowOfJob(j: JobLike, serverName?: string, stepId?: string): QueueRow | null {
  if (j.status !== 'running' && j.status !== 'queued') return null;
  const progress = j.progress && j.progress.max > 0 ? Math.min(1, Math.max(0, j.progress.value / j.progress.max)) : undefined;
  return {
    id: j.id, stepId, source: 'image', label: short(j.positive), status: j.status,
    progress, startedAt: j.createdAt,
    detail: [serverName, j.status === 'running' ? j.node : undefined].filter(Boolean).join(' · ') || undefined,
  };
}

export function rowOfRun(source: 'video' | 'workflow', run: RunLike, stepId?: string): QueueRow | null {
  if (!run.busy) return null;
  // A run with no node yet and others ahead of it on the server is still queued there.
  const queued = !run.currentNode && run.progress == null && run.queueRemaining > 0;
  return {
    id: `${source}-run`, stepId, source, label: source === 'video' ? 'Video' : 'Workflow',
    status: queued ? 'queued' : 'running', progress: run.progress ?? undefined, startedAt: run.startedAt ?? undefined,
    detail: run.currentNode ?? run.status ?? undefined,
  };
}

/** Running rows first (oldest first), then queued (oldest first). */
export function orderRows(rows: QueueRow[]): QueueRow[] {
  const by = (a: QueueRow, b: QueueRow) => (a.startedAt ?? 0) - (b.startedAt ?? 0);
  return [...rows.filter((r) => r.status === 'running').sort(by), ...rows.filter((r) => r.status === 'queued').sort(by)];
}
