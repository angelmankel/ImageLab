import { StatusPill } from './StatusPill';
import { QueueButton } from './QueueButton';
import { DownloadsButton } from '@/features/downloads';
import { RoutingPicker } from '@/features/generate/RoutingPicker';

/**
 * Connection status, the job queue, model downloads, and which server runs the next job —
 * the "what is happening" cluster. It lives in the bar above the canvas, not in the
 * parameters panel, so the panel is only parameters.
 */
export function JobStatusCluster() {
  return (
    <div className="flex items-center gap-1.5">
      <StatusPill />
      <RoutingPicker variant="nav" align="start" />
      <QueueButton />
      <DownloadsButton />
    </div>
  );
}
