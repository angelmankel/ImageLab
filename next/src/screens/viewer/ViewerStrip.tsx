/**
 * Item 30: the viewer's thumbnail rail — on the LEFT (results never sit at the bottom), one
 * column of 72px tiles, the shown one ringed in ember, kept in view without a scroll animation.
 * A click is a cut (item 3). Thumbnails load lazily; a cut-out shows its checkerboard.
 */
import { memo, useEffect, useRef } from 'react';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import { CHECKER, mayHaveAlpha } from '~/screens/image/checker';
import type { ViewerItem } from './types';

export const ViewerStrip = memo(function ViewerStrip({ items, index, onPick }: { items: readonly ViewerItem[]; index: number; onPick: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
  }, [index]);
  return (
    <div ref={box} className="il-scroll" style={{ width: 92, flex: 'none', overflowY: 'auto', overflowX: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid var(--il-line)', background: 'var(--il-bg-deep)', touchAction: 'pan-y' }}>
      {items.map((it, i) => (
        <button key={it.key} type="button" data-i={i} onClick={() => onPick(i)} aria-label={it.filename} aria-current={i === index}
          style={{ width: 72, height: 72, flex: 'none', padding: 0, border: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: 'var(--il-card)', opacity: i === index ? 1 : 0.62, boxShadow: i === index ? '0 0 0 2px var(--il-ember)' : undefined }}>
          {it.kind === 'video'
            ? <><video src={it.url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /><IconPlayerPlayFilled size={16} style={{ position: 'absolute', left: 6, bottom: 6, color: '#fff' }} /></>
            : <img src={it.url} alt="" loading="lazy" decoding="async" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(mayHaveAlpha(it.filename) ? CHECKER : {}) }} />}
        </button>
      ))}
    </div>
  );
});
