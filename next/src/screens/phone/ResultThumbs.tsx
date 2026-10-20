/**
 * The Output page's results strip: square thumbnails under the picture, the current one outlined
 * in ember and kept centred. A tap shows it (the picture slides to it); a tap on the current one
 * opens it full screen. Ends with a "Library" tile for everything older.
 */
import { useEffect, useRef } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import type { ResultItem } from '@/lib/workspace';
import { T } from '~/theme/tokens';

const SIZE = 56;
const MAX = 60;

export function ResultThumbs({ items, currentKey, onPick, onOpen, onMore }: {
  items: readonly ResultItem[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
  onMore?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = ref.current;
    const el = currentKey ? strip?.querySelector<HTMLElement>(`[data-key="${CSS.escape(currentKey)}"]`) : null;
    if (!strip || !el) return;
    strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [currentKey]);

  if (!items.length) return null;
  const shown = items.slice(0, MAX);
  return (
    <div ref={ref} className="il-scroll-x" data-no-swipe role="listbox" aria-label="Results"
      style={{ position: 'relative', display: 'flex', gap: T.gap.sm, padding: `0 ${T.pad.panel}px`, touchAction: 'pan-x pan-y' }}>
      {shown.map((it) => {
        const on = it.key === currentKey;
        return (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={on}
            data-key={it.key}
            onClick={() => (on ? onOpen(it.key) : onPick(it.key))}
            style={{
              width: SIZE, height: SIZE, flex: 'none', padding: 0, border: 0, borderRadius: T.radius.sm, overflow: 'hidden', cursor: 'pointer',
              background: 'var(--il-card)', outline: on ? '2px solid var(--il-ember)' : 'none', outlineOffset: -2, opacity: on ? 1 : 0.8,
            }}
          >
            {it.kind === 'video'
              ? <video src={it.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <img src={it.url} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </button>
        );
      })}
      {onMore && items.length > MAX && (
        <button type="button" onClick={onMore} aria-label="All results in the Library"
          style={{ width: SIZE, height: SIZE, flex: 'none', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.sm, background: 'transparent', color: 'var(--il-muted)', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><IconChevronRight size={16} />Library</span>
        </button>
      )}
    </div>
  );
}
