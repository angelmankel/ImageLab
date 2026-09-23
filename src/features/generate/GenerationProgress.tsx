import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';

export function GenerationProgress() {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const serverInfo = useStore(s => s.serverInfo);
  const status = useStore(s => s.status);
  const activity = jobActivity(jobs, submitting, Object.keys(serverInfo).length > 0);
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-fg-secondary">{activity.label}{activity.percent !== null && ` · ${activity.percent}%`}</span>
        <span className="text-fg-muted">{activity.queued > 0 ? `${activity.queued} queued` : activity.percent !== null ? activity.detail : ''}</span>
      </div>
      {activity.active && <div role="progressbar" aria-label={activity.percent !== null ? 'Current sampling pass' : activity.label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={activity.percent ?? undefined}
        aria-valuetext={activity.percent !== null ? activity.detail : activity.label}
        className="h-1.5 overflow-hidden rounded-full bg-bg-input">
        <div className={activity.percent === null ? 'h-full w-full animate-pulse rounded-full bg-accent/50' : 'h-full rounded-full bg-accent transition-[width] duration-200'}
          style={activity.percent !== null ? { width: `${activity.percent}%` } : undefined} />
      </div>}
      {status.kind === 'error' && <div role="alert" className="flex items-start gap-2 rounded-lg bg-status-err/10 p-2 text-xs text-status-err">
        <span className="min-w-0 flex-1 break-words">{status.text}</span>
        <button type="button" onClick={() => useStore.getState().setStatus('Ready', 'ok')} className="shrink-0 underline">Dismiss</button>
      </div>}
    </div>
  );
}
