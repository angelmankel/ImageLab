/**
 * The recent results as a strip of thumbnails: the current one outlined, the rest dimmed. One tap
 * shows it in the hero; a second tap on the current one opens it full screen. Video thumbnails are
 * the clip's first frame.
 */
import { useEffect, useRef } from 'react';
import { UnstyledButton } from '@mantine/core';
import { cn } from '@/lib/cn';
import type { ResultItem } from '@/lib/workspace';

export function ResultsStrip({ items, currentKey, onPick, onOpen, size = 64, className }: {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  /** The current item tapped again, or any item double-clicked. */
  onOpen?: (key: string) => void;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the current thumbnail in view as results arrive or the arrows walk the strip.
  useEffect(() => {
    if (!currentKey) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(currentKey)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [currentKey]);
  if (!items.length) return null;
  return (
    <div ref={ref} className={cn('scroll-x-thin flex shrink-0 gap-2 pb-1', className)} style={{ touchAction: 'pan-x' }} role="listbox" aria-label="Recent results">
      {items.map(r => {
        const current = r.key === currentKey;
        return (
          <UnstyledButton
            key={r.key}
            data-key={r.key}
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
}
