/**
 * The recent results as a strip of thumbnails: the current one outlined and kept centred, the rest
 * dimmed. One tap shows it in the hero (which slides to it); a second tap on the current one opens
 * it full screen. Video thumbnails are the clip's first frame. While the hero is being dragged the
 * strip follows the finger through `follow()`, so the two never disagree.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { UnstyledButton } from '@mantine/core';
import { cn } from '@/lib/cn';
import { lastInputWasTouch } from '@/lib/inputModality';
import { centredScrollLeft } from '@/lib/pager';
import type { ResultItem } from '@/lib/workspace';

export interface ResultsStripHandle {
  /** -1..1: how far the hero is towards the next (+) / previous (−) result; 0 when settled. */
  follow: (fraction: number) => void;
}

const GAP = 8;

export const ResultsStrip = forwardRef<ResultsStripHandle, {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  /** The current item tapped again, or any item double-clicked. */
  onOpen?: (key: string) => void;
  size?: number;
  className?: string;
}>(function ResultsStrip({ items, currentKey, onPick, onOpen, size = 64, className }, handle) {
  const ref = useRef<HTMLDivElement>(null);
  const followedAt = useRef(0);

  const currentEl = () => currentKey ? ref.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(currentKey)}"]`) ?? null : null;

  useImperativeHandle(handle, () => ({
    follow: (fraction) => {
      const strip = ref.current;
      const el = currentEl();
      if (!strip || !el) return;
      followedAt.current = performance.now();
      // Setting scrollLeft also stops any smooth scroll that was under way.
      strip.scrollLeft = centredScrollLeft(el.offsetLeft, el.offsetWidth, strip.clientWidth) + fraction * (el.offsetWidth + GAP);
    },
  }), [currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the current thumbnail centred as results arrive or something else picks one — unless the
  // hero is driving the strip right now.
  useEffect(() => {
    const strip = ref.current;
    const el = currentEl();
    if (!strip || !el || performance.now() - followedAt.current < 100) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({ left: centredScrollLeft(el.offsetLeft, el.offsetWidth, strip.clientWidth), behavior: reduced || !lastInputWasTouch() ? 'auto' : 'smooth' });
  }, [currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length) return null;
  return (
    <div ref={ref} className={cn('scroll-x-thin flex shrink-0 pb-1', className)} style={{ touchAction: 'pan-x', gap: GAP }} role="listbox" aria-label="Recent results">
      {items.map(r => {
        const current = r.key === currentKey;
        return (
          <UnstyledButton
            key={r.key}
            data-key={r.key}
            data-viewer-origin={r.key}
            role="option"
            aria-selected={current}
            onClick={() => (current ? onOpen?.(r.key) : onPick(r.key))}
            onDoubleClick={() => onOpen?.(r.key)}
            aria-label={`Show ${r.filename}`}
            className={cn(
              'relative shrink-0 overflow-hidden rounded-md border-2 transition-all duration-150',
              current ? 'border-[var(--mantine-primary-color-filled)]' : 'border-transparent opacity-70 hover:opacity-100',
            )}
            style={{ width: size, height: size }}
          >
            {r.kind === 'video'
              ? <video src={r.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              : <img src={r.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
            {r.kind === 'video' && <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">MP4</span>}
          </UnstyledButton>
        );
      })}
    </div>
  );
});
