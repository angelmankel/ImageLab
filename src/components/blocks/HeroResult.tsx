/**
 * The big result. A live preview frame outranks everything while a run goes, with the progress
 * under it; otherwise the picked result, image or video. One tap opens it full screen (videos on a
 * phone open the touch player). `children` float over it: badges, an action toolbar.
 *
 * It pages like a photo app: a sideways drag moves the picture 1:1 with its neighbour sliding in
 * beside it, a release pages on distance or on a flick and springs back otherwise, the ends
 * rubber-band (`hooks/usePager`, maths in `lib/pager.ts`). A pick from anywhere — the strip, the
 * arrow keys, the wheel, the controller — slides the same way, so there is never a hard cut. The
 * neighbours are real elements already decoded, so they never pop in blank.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Progress } from '@mantine/core';
import { VideoFullscreen } from '@/components/VideoFullscreen';
import { bindPagerPointer, usePager } from '@/hooks/usePager';
import { usePreloadAround } from '@/hooks/usePreload';
import { useTouchInput } from '@/hooks/useTouchInput';
import { cn } from '@/lib/cn';
import { SLIDE_GAP, createWheelStepper, lockAxis } from '@/lib/pager';
import { playOrMute, videoHasAudio } from '@/lib/videoAudio';
import type { ResultItem } from '@/lib/workspace';

const SIDES = [-1, 0, 1] as const;
const NO_ITEMS: readonly ResultItem[] = [];

export function HeroResult({ items = NO_ITEMS, currentKey = null, onPick, preview, busy, progress, statusLine, queued, onOpen, onDragProgress, empty, children, className, bare, hideProgress, slideOnlyOnDrag }: {
  /** Every result, in strip order (newest first); the hero shows `currentKey` and pages among them. */
  items?: readonly ResultItem[];
  currentKey?: string | null;
  /** A swipe, wheel or key landed on another result. */
  onPick?: (key: string) => void;
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
  /** -1..1 while the track moves towards the next (+) / previous (−) result; the strip follows it. */
  onDragProgress?: (fraction: number) => void;
  /** Shown when there is nothing yet. */
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** No frame, no rounding: the stage of the new workspace, which fills its column edge to edge. */
  bare?: boolean;
  /** The caller draws its own progress band (the stage floats one above its filmstrip). */
  hideProgress?: boolean;
  /** Only a finger's swipe slides; a pick, a key, a wheel or a new result arriving is a cut (the next UI). */
  slideOnlyOnDrag?: boolean;
}) {
  const index = items.findIndex(i => i.key === currentKey);
  const item = items[index] ?? null;
  const live = busy && preview ? preview : null;
  const touch = useTouchInput();
  const [videoFs, setVideoFs] = useState<{ url: string; time: number } | null>(null);
  const resumeAt = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const keys = items.map(i => i.key);
  const canPage = items.length > 1 && !live;
  const pager = usePager({
    keys,
    index,
    onIndexChange: i => { const it = items[i]; if (it) onPick?.(it.key); },
    enabled: canPage && !!onPick,
    slideOnlyOnDrag,
    onProgress: onDragProgress,
  });
  usePreloadAround(items.map(i => i.url), index);

  // A finger (or a mouse) on the hero drives the track directly.
  const drag = pager.drag;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return bindPagerPointer(el, drag, lockAxis);
  }, [drag]);

  // A wheel over the hero steps through the results, one per gesture.
  const wheel = useRef(createWheelStepper());
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || !canPage) return;
    const dir = wheel.current.feed(e.deltaY + e.deltaX, e.timeStamp);
    if (dir) pager.step(dir);
  };

  /** The item drawn on a side: the one leaving (ghost) while a slide runs, else the neighbour. */
  const slideItem = (side: -1 | 0 | 1): ResultItem | null => {
    if (side === 0) return item;
    if (live) return null;
    if (pager.ghost?.side === side) return items.find(i => i.key === pager.ghost!.key) ?? null;
    return items[index + side] ?? null;
  };

  // A clip with a soundtrack (MiniMax H3) plays unmuted; if the browser refuses unmuted autoplay
  // (no gesture yet), it falls back to muted so the picture still moves.
  const renderCurrent = (it: ResultItem) => it.kind === 'video' ? (
    <video
      key={it.url} src={it.url} controls={!touch} autoPlay loop muted={!videoHasAudio(it.filename)} playsInline
      data-viewer-origin={it.key}
      onClick={touch ? (e) => setVideoFs({ url: it.url, time: e.currentTarget.currentTime }) : undefined}
      onDoubleClick={touch ? undefined : () => onOpen?.(it)}
      onLoadedMetadata={(e) => {
        if (resumeAt.current != null) { e.currentTarget.currentTime = resumeAt.current; resumeAt.current = null; }
        playOrMute(e.currentTarget);
      }}
      className="h-full w-full object-contain"
    />
  ) : (
    <img
      src={it.url}
      alt={it.filename}
      data-viewer-origin={it.key}
      draggable={false}
      onClick={() => onOpen?.(it)}
      className="h-full w-full cursor-zoom-in object-contain"
    />
  );

  const renderNeighbour = (it: ResultItem) => it.kind === 'video'
    ? <video src={it.url} muted playsInline preload="metadata" className="h-full w-full object-contain" />
    : <img src={it.url} alt="" draggable={false} decoding="async" className="h-full w-full object-contain" />;

  return (
    <div
      ref={root}
      onWheel={onWheel}
      // pan-y: the browser keeps any vertical scroll; sideways is ours.
      style={{ touchAction: 'pan-y' }}
      className={cn(
        'flex items-center justify-center overflow-hidden bg-bg-base',
        bare ? 'absolute inset-0' : 'relative min-h-0 flex-1 rounded-xl border border-border-default',
        className,
      )}
    >
      {item && !live ? (
        <div ref={pager.trackRef} className="absolute inset-0">
          {SIDES.map(side => {
            const it = slideItem(side);
            if (!it) return null;
            return (
              <div
                key={`${side}:${it.key}`}
                className="absolute inset-0"
                style={side ? { transform: `translateX(calc(${side} * (100% + ${SLIDE_GAP}px)))` } : undefined}
              >
                {side === 0 ? renderCurrent(it) : renderNeighbour(it)}
              </div>
            );
          })}
        </div>
      ) : live ? (
        // h-full w-full + object-contain scales a small preview frame up to the whole area.
        <img src={live} alt="Live preview" className="h-full w-full object-contain" />
      ) : (
        <div className="px-6 text-center text-[13px] italic text-fg-muted">
          {busy ? (statusLine ?? 'Working…') : (empty ?? 'Nothing yet — press Generate.')}
        </div>
      )}

      {busy && !hideProgress && (
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
