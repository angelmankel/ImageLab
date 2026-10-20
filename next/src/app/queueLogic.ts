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
  /** Images this job makes (an image job's batch), when more than one. */
  count?: number;
}

export interface JobLike {
  id: string;
  status: string;
  createdAt: number;
  progress?: { value: number; max: number };
  node?: string;
  serverId: string;
  positive?: string;
  workflow?: { batch?: number };
}

export interface RunLike {
  busy: boolean;
  status: string | null;
  progress: number | null;
  currentNode: string | null;
  startedAt: number | null;
  /** Jobs waiting on that server (other clients' too). */
  queueRemaining: number;
  /** Every run of ours still to finish (several when Generate was pressed again while one ran). */
  jobs?: ReadonlyArray<{ promptId: string; queuedAt: number; running: boolean; progress: number | null }>;
}

/** A run row's id: `video-run` (the whole store) or `video-run:<promptId>` (one queued run). */
export function parseRunRowId(id: string): { source: 'video' | 'workflow'; promptId?: string } | null {
  const m = /^(video|workflow)-run(?::(.+))?$/.exec(id);
  return m ? { source: m[1] as 'video' | 'workflow', promptId: m[2] } : null;
}

/** One row per run of ours (item 46: several may be queued); the store's single row while it is still building. */
export function rowsOfRun(source: 'video' | 'workflow', run: RunLike, stepId?: string): QueueRow[] {
  if (!run.busy) return [];
  if (!run.jobs?.length) { const r = rowOfRun(source, run, stepId); return r ? [r] : []; }
  const label = source === 'video' ? 'Video' : 'Workflow';
  return run.jobs.map((j) => ({
    id: `${source}-run:${j.promptId}`, stepId, source, label, status: j.running ? 'running' : 'queued',
    progress: j.running ? (j.progress ?? undefined) : undefined, startedAt: j.queuedAt,
    detail: j.running ? (run.currentNode ?? run.status ?? undefined) : undefined,
  }));
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
    progress, startedAt: j.createdAt, ...((j.workflow?.batch ?? 1) > 1 ? { count: j.workflow!.batch } : {}),
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
