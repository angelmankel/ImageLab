/**
 * Item 23: Compare — the stage split in two. The shown result on the right ("after"), another one
 * on the left ("before"), one draggable divider; a drag or a tap anywhere in the picture moves it,
 * ←/→ nudge it when the divider has focus. Its own 40px row on top picks the "before" side
 * (‹ › step through the results; default = the source of a cut-out, else the previous result),
 * swaps the sides, or closes. Nothing sits on the picture but the divider line itself.
 * Both pictures share one fitted box (`fitBox`), so a pixel on the left lines up with the right.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconArrowsLeftRight, IconX } from '@tabler/icons-react';
import type { ResultItem } from '@/lib/workspace';
import { IconBtn } from '~/ui';
import { CHECKER, mayHaveAlpha } from './checker';
import { fitBox, splitAt, stepCompare } from './compareLogic';
import { useStage } from './stageStore';

const round: React.CSSProperties = { borderRadius: '50%', background: 'var(--il-elev)' };

export function CompareView({ items, shown, other }: { items: readonly ResultItem[]; shown: number; other: number }) {
  const setKey = useStage((s) => s.setCompareKey);
  const setCompare = useStage((s) => s.setCompare);
  const [swap, setSwap] = useState(false);
  const [pct, setPct] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const dragging = useRef(false);

  const after = items[shown];
  const before = items[other];
  const left = swap ? after : before;
  const right = swap ? before : after;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const f = fitBox(nat.w, nat.h, r.width, r.height);
    setPct(splitAt(clientX, r.left + f.left, f.width));
  }, [nat]);

  const fit = fitBox(nat.w, nat.h, size.w, size.h);
  const pic = (it: ResultItem): React.CSSProperties => ({
    position: 'absolute', left: fit.left, top: fit.top, width: fit.width, height: fit.height, objectFit: 'contain', display: 'block',
    ...(mayHaveAlpha(it.filename) ? CHECKER : {}),
  });
  const step = (dir: 1 | -1) => { const i = stepCompare(items, shown, other, dir); const it = items[i]; if (it) setKey(it.key); };
  const label = (it: ResultItem | undefined, side: string) => (
    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>
      <span style={{ color: 'var(--il-muted)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 6 }}>{side}</span>
      {it?.filename ?? '—'}
    </span>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg-deep)' }}>
      <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--il-line)' }}>
        <IconBtn icon={<IconChevronLeft size={15} stroke={2.4} />} label="Newer result on the left" onClick={() => step(-1)} style={round} />
        <IconBtn icon={<IconChevronRight size={15} stroke={2.4} />} label="Older result on the left" onClick={() => step(1)} style={round} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {label(left, swap ? 'After' : 'Before')}
          {label(right, swap ? 'Before' : 'After')}
        </div>
        <IconBtn icon={<IconArrowsLeftRight size={15} stroke={2.4} />} label="Swap sides" on={swap} onClick={() => setSwap(!swap)} style={round} />
        <IconBtn icon={<IconX size={15} stroke={2.4} />} label="Close compare" onClick={() => setCompare(false)} style={round} />
      </div>
      <div
        ref={box}
        aria-label="Compare"
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: 'ew-resize', userSelect: 'none' }}
        onPointerDown={(e) => { if (e.button !== 0) return; dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
        onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {right && <img key={`r-${right.key}`} src={right.url} alt="" draggable={false} style={pic(right)}
          onLoad={(e) => { if (right === after) setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }} />}
        {left && <img key={`l-${left.key}`} src={left.url} alt="" draggable={false}
          onLoad={(e) => { if (left === after) setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }}
          style={{ ...pic(left), clipPath: `inset(0 ${100 - pct}% 0 0)` }} />}
        {fit.width > 0 && (
          <div
            role="slider" tabIndex={0} aria-label="Split position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setPct((p) => Math.max(0, p - (e.shiftKey ? 10 : 2))); }
              if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setPct((p) => Math.min(100, p + (e.shiftKey ? 10 : 2))); }
            }}
            style={{ position: 'absolute', top: fit.top, height: fit.height, left: fit.left + (fit.width * pct) / 100 - 12, width: 24, display: 'flex', justifyContent: 'center', outline: 'none' }}
          >
            <div style={{ width: 2, height: '100%', background: 'var(--il-fg)', boxShadow: '0 0 0 1px rgba(0,0,0,.35)' }} />
          </div>
        )}
      </div>
    </div>
  );
}
