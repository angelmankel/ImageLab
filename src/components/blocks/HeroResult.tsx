/**
 * The big result. A live preview frame outranks everything while a run goes, with the progress
 * under it; otherwise the picked result, image or video. One tap opens it full screen (videos on a
 * phone open the touch player). `children` float over it: badges, an action toolbar.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Progress } from '@mantine/core';
import { VideoFullscreen } from '@/components/VideoFullscreen';
import { useTouchInput } from '@/hooks/useTouchInput';
import { cn } from '@/lib/cn';
import type { ResultItem } from '@/lib/workspace';

export function HeroResult({ item, preview, busy, progress, statusLine, queued, onOpen, empty, children, className }: {
  item: ResultItem | null;
  /** The running job's latest preview frame. */
  preview?: string | null;
  busy: boolean;
  /** 0..1 through the current sampler, or null between nodes. */
  progress?: number | null;
  /** What the machine is doing: a node name, "Queued"… */
  statusLine?: string | null;
  /** Jobs ahead of this one on the server. */
  queued?: number;
  onOpen?: (item: ResultItem) => void;
  /** Shown when there is nothing yet. */
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const live = busy && preview ? preview : null;
  const shown = live ?? item?.url ?? null;
  const isVideo = !live && item?.kind === 'video';
  const touch = useTouchInput();
  const [videoFs, setVideoFs] = useState<{ url: string; time: number } | null>(null);
  const resumeAt = useRef<number | null>(null);

  return (
    <div className={cn('relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border-default bg-bg-base', className)}>
      {shown && isVideo && item ? (
        <video
          key={shown} src={shown} controls={!touch} autoPlay loop muted playsInline
          onClick={touch ? (e) => setVideoFs({ url: shown, time: e.currentTarget.currentTime }) : undefined}
          onDoubleClick={touch ? undefined : () => onOpen?.(item)}
          onLoadedMetadata={(e) => { if (resumeAt.current != null) { e.currentTarget.currentTime = resumeAt.current; resumeAt.current = null; } }}
          className="h-full w-full object-contain"
        />
      ) : shown ? (
        <img
          src={shown}
          alt={live ? 'Live preview' : item?.filename ?? 'Result'}
          onClick={() => { if (!live && item) onOpen?.(item); }}
          // h-full w-full + object-contain scales a small preview frame up to the whole area.
          className={cn('h-full w-full object-contain', !live && 'cursor-zoom-in')}
        />
      ) : (
        <div className="px-6 text-center text-[13px] italic text-fg-muted">
          {busy ? (statusLine ?? 'Working…') : (empty ?? 'Nothing yet — press Generate.')}
        </div>
      )}

      {busy && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
          <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-white/85">
            <span className="truncate">{statusLine ?? 'Working…'}</span>
            <span className="shrink-0 tabular-nums">
              {progress != null ? `${Math.round(progress * 100)}%` : ''}
              {queued ? ` · ${queued} queued` : ''}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            {progress != null ? (
              <Progress value={Math.max(2, progress * 100)} size={4} radius="xl" bg="transparent" transitionDuration={150} />
            ) : (
              // Between nodes there are no steps to count, so sweep rather than sit at zero.
              <div className="animate-view-loading h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />
            )}
          </div>
        </div>
      )}

      {children}

      {videoFs && (
        <VideoFullscreen url={videoFs.url} startTime={videoFs.time} onClose={(t) => { resumeAt.current = t; setVideoFs(null); }} />
      )}
    </div>
  );
}
