/**
 * Everything running right now, across modes: one pill per image job, one for the video run, one
 * for the workflow run, each with its own progress. Images and video run on different servers, so
 * two pills at once is the normal case. Tapping a pill switches to its mode.
 */
import { IconMovie, IconPhoto, IconRoute, IconX } from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useVideoRun } from '@/features/video/videoRun';
import { useCanvasStore } from '@/lib/canvasStore';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import { viewOfMode, type WorkspaceMode } from '@/lib/workspace';

interface Pill { key: string; mode: WorkspaceMode; label: string; detail: string; pct: number | null; onCancel?: () => void; error?: boolean }

const ICON: Record<WorkspaceMode, React.ReactNode> = {
  image: <IconPhoto size={13} stroke={1.8} />,
  video: <IconMovie size={13} stroke={1.8} />,
  workflow: <IconRoute size={13} stroke={1.8} />,
};

export function useJobPills(): Pill[] {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const cancelJob = useStore(s => s.cancelJob);
  const removeJob = useStore(s => s.removeJob);
  const video = useVideoRun(useShallow(s => ({ busy: s.busy, progress: s.progress, node: s.currentNode, status: s.status })));
  const wf = useWorkflowRun(useShallow(s => ({ busy: s.busy, progress: s.progress, node: s.currentNode, status: s.status })));

  const pills: Pill[] = jobs.map(j => ({
    key: j.id,
    mode: 'image',
    label: j.status === 'error' ? 'Image failed' : j.status === 'running' ? 'Image' : 'Image queued',
    detail: j.status === 'error' ? (j.error ?? 'error') : j.status === 'running' ? (j.progress ? `${j.progress.value}/${j.progress.max}` : (j.node ?? 'starting')) : 'waiting',
    pct: j.status === 'running' && j.progress && j.progress.max > 0 ? Math.round(j.progress.value / j.progress.max * 100) : null,
    error: j.status === 'error',
    onCancel: () => (j.status === 'error' ? removeJob(j.id) : cancelJob(j.id)),
  }));
  if (submitting) pills.unshift({ key: 'submitting', mode: 'image', label: 'Image', detail: 'queueing', pct: null });
  if (video.busy) pills.push({ key: 'video', mode: 'video', label: 'Video', detail: video.node ?? video.status ?? 'running', pct: video.progress != null ? Math.round(video.progress * 100) : null, onCancel: () => void useVideoRun.getState().cancel() });
  if (wf.busy) pills.push({ key: 'workflow', mode: 'workflow', label: 'Workflow', detail: wf.node ?? wf.status ?? 'running', pct: wf.progress != null ? Math.round(wf.progress * 100) : null, onCancel: () => void useWorkflowRun.getState().cancel() });
  return pills;
}

export function JobTray({ className, compact }: { className?: string; compact?: boolean }) {
  const pills = useJobPills();
  const setMainView = useCanvasStore(s => s.setMainView);
  if (!pills.length) return null;
  return (
    <div className={cn('scroll-x-thin flex items-center gap-1.5', className)} aria-label="Running jobs" aria-live="polite">
      {pills.map(p => (
        <div
          key={p.key}
          className={cn(
            'relative flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-full border pl-2 pr-1 text-[11px]',
            p.error ? 'border-red-500/50 bg-red-500/10 text-red-300' : 'border-border-default bg-bg-elev text-fg-secondary',
          )}
        >
          <button type="button" onClick={() => setMainView(viewOfMode(p.mode))} className="flex items-center gap-1.5 outline-none" aria-label={`${p.label}: ${p.detail}`}>
            <span className={p.error ? 'text-red-400' : 'text-accent-fg'}>{ICON[p.mode]}</span>
            <span className="font-semibold">{p.label}</span>
            {!compact && <span className="max-w-[140px] truncate text-fg-muted">{p.detail}</span>}
            {p.pct != null && <span className="tabular-nums">{p.pct}%</span>}
          </button>
          {p.onCancel && (
            <button type="button" onClick={p.onCancel} aria-label={p.error ? 'Dismiss' : 'Stop'} className="flex h-5 w-5 items-center justify-center rounded-full text-fg-muted hover:bg-bg-card-on hover:text-fg-primary">
              <IconX size={12} />
            </button>
          )}
          {!p.error && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
              {p.pct != null
                ? <span className="block h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.max(2, p.pct)}%` }} />
                : <span className="animate-view-loading block h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
