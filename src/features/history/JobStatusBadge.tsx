import { Badge } from '@mantine/core';
import type { Job, JobStatus } from '@/lib/types';

/** v1's JobStatusBadge colours, mapped onto this app's three job states. */
const STATUS_COLORS: Record<JobStatus, string> = {
  queued: 'blue',
  running: 'blue',
  error: 'red',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'queued',
  running: 'running',
  error: 'failed',
};

/** Sampler progress as a whole percent, or null before the first progress event. */
export function jobPercent(job: Job): number | null {
  const p = job.progress;
  if (!p || p.max <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((p.value / p.max) * 100)));
}

/** Filled status badge; a running job shows its percent instead of the word, as in v1. */
export function JobStatusBadge({ job, size = 'xs' }: { job: Job; size?: 'xs' | 'sm' | 'md' }) {
  const pct = job.status === 'running' ? jobPercent(job) : null;
  return (
    <Badge size={size} color={STATUS_COLORS[job.status]} variant="filled">
      {pct !== null ? `${pct}%` : STATUS_LABELS[job.status]}
    </Badge>
  );
}
