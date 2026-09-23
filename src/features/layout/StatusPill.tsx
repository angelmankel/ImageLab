import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import { cn } from '@/lib/cn';

export function StatusPill() {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const info = useStore(s => s.serverInfo);
  const activity = jobActivity(jobs, submitting, Object.keys(info).length > 0);
  return <div className="inline-flex h-7 items-center gap-2 px-1 text-[11px] font-medium text-fg-secondary">
    <span className={cn('h-2 w-2 rounded-full', activity.active ? 'bg-accent animate-pulse' : activity.label === 'Ready' ? 'bg-status-ok' : 'bg-fg-dim')} />
    {activity.label}
  </div>;
}
