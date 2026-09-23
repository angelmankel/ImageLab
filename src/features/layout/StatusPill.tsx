import { Badge } from '@mantine/core';
import { useStore } from '@/lib/store';
import { jobActivity } from '@/lib/jobActivity';
import { cn } from '@/lib/cn';

/** Connection / activity state as a compact 30px nav badge beside the queue and downloads. */
export function StatusPill() {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const info = useStore(s => s.serverInfo);
  const activity = jobActivity(jobs, submitting, Object.keys(info).length > 0);
  const dot = activity.active
    ? 'bg-accent animate-pulse'
    : activity.label === 'Ready' ? 'bg-status-ok' : 'bg-fg-dim';
  return (
    <Badge
      variant="default"
      size="lg"
      radius="sm"
      h={30}
      tt="none"
      fw={500}
      aria-live="polite"
      leftSection={<span className={cn('block h-2 w-2 rounded-full', dot)} />}
      styles={{ label: { fontSize: 11 } }}
    >
      {activity.label}
    </Badge>
  );
}
