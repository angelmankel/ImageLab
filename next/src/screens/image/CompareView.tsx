/**
 * Item 23 + list-2 item 49: Compare — the stage split in two. The shown result ("After") on the
 * LEFT of the line, the other one ("Before") on the right: the line at the right edge = After
 * fully shown. Its own 40px row on top (no file names): ‹ › pick the Before picture (default =
 * the source of a cut-out, else the previous result), the small After / Before tags, and
 *   - mouse (`(hover: hover) and (pointer: fine)`): swap the sides; the line follows the pointer
 *     while it is over the picture, no click; leaving keeps the last spot.
 *   - touch: the line starts at the right edge (After shown); drag it (big round handle) or tap
 *     the After | Before toggle to jump the whole way.
 * ←/→ nudge the line when it has focus. Nothing sits on the picture but the line (and its handle
 * on touch). Both pictures share one fitted box (`fitBox`), so a pixel lines up on both sides.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconArrowsLeftRight, IconX, IconArrowsHorizontal } from '@tabler/icons-react';
import type { ResultItem } from '@/lib/workspace';
import { IconBtn } from '~/ui';
import { CHECKER, mayHaveAlpha } from './checker';
import { fitBox, splitAt, stepCompare } from './compareLogic';
import { useStage } from './stageStore';

const HANDLE = 44;

function Tag({ label, after }: { label: string; after?: boolean }) {
  return (
    <span style={{ height: 22, padding: '0 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', flex: 'none',
      background: after ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: after ? 'var(--il-ember-hi)' : 'var(--il-fg2)' }}>{label}</span>
  );
}

export function CompareView({ items, shown, other }: { items: readonly ResultItem[]; shown: number; other: number }) {
  const setKey = useStage((s) => s.setCompareKey);
  const setCompare = useStage((s) => s.setCompare);
  const mouse = useMediaQuery('(hover: hover) and (pointer: fine)', true, { getInitialValueInEffect: false });
  /** Mouse only: Before on the left, After on the right. */
  const [swap, setSwap] = useState(false);
  /** The line, % of the picture's width from its left edge. Touch starts at the right edge (After). */
  const [pct, setPct] = useState(() => (mouse ? 50 : 100));
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const dragging = useRef(false);

  const after = items[shown];
  const before = items[other];
  const flip = mouse && swap;
  const left = flip ? before : after;
  const right = flip ? after : before;

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
  const onLoad = (it: ResultItem) => (e: React.SyntheticEvent<HTMLImageElement>) => { if (it === after) setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); };
  const showingAfter = pct >= 50;
  const lineX = fit.left + (fit.width * pct) / 100;
  const handleX = Math.min(Math.max(lineX, fit.left + HANDLE / 2), fit.left + fit.width - HANDLE / 2);

  return (
    <div data-no-swipe style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg-deep)' }}>
      <div style={{ height: mouse ? 40 : 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--il-line)' }}>
        <IconBtn icon={<IconChevronLeft size={15} stroke={2.4} />} label="Newer to compare" onClick={() => step(-1)} size={mouse ? 32 : 40} />
        <IconBtn icon={<IconChevronRight size={15} stroke={2.4} />} label="Older to compare" onClick={() => step(1)} size={mouse ? 32 : 40} />
        {mouse ? (
          <>
            <Tag label={flip ? 'Before' : 'After'} after={!flip} />
            <div style={{ flex: 1 }} />
            <Tag label={flip ? 'After' : 'Before'} after={flip} />
            <IconBtn icon={<IconArrowsLeftRight size={15} stroke={2.4} />} label="Swap sides" on={swap} onClick={() => setSwap(!swap)} size={32} />
          </>
        ) : (
          <>
            <div style={{ flex: 1 }} />
            <div role="radiogroup" aria-label="Show" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--il-elev)' }}>
              {([['After', 100], ['Before', 0]] as const).map(([label, to]) => {
                const on = label === 'After' ? showingAfter : !showingAfter;
                return (
                  <button key={label} type="button" role="radio" aria-checked={on} onClick={() => setPct(to)}
                    style={{ height: 34, minWidth: 64, padding: '0 12px', border: 0, borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: 'pointer', background: on ? 'var(--il-ember)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-fg2)' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <IconBtn icon={<IconX size={15} stroke={2.4} />} label="Close compare" onClick={() => setCompare(false)} size={mouse ? 32 : 40} />
      </div>
      <div
        ref={box}
        aria-label="Compare"
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', touchAction: 'none', cursor: mouse ? 'col-resize' : undefined, userSelect: 'none' }}
        onPointerMove={(e) => { if (e.pointerType === 'mouse' ? mouse : dragging.current) move(e.clientX); }}
        onPointerDown={(e) => { if (e.pointerType === 'mouse' && mouse) { move(e.clientX); return; } if (e.button !== 0) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {left && <img key={`l-${left.key}`} src={left.url} alt="" draggable={false} onLoad={onLoad(left)} style={pic(left)} />}
        {right && <img key={`r-${right.key}`} src={right.url} alt="" draggable={false} onLoad={onLoad(right)} style={{ ...pic(right), clipPath: `inset(0 0 0 ${pct}%)` }} />}
        {fit.width > 0 && (
          <div
            role="slider" tabIndex={0} aria-label="Split position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setPct((p) => Math.max(0, p - (e.shiftKey ? 10 : 2))); }
              if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setPct((p) => Math.min(100, p + (e.shiftKey ? 10 : 2))); }
            }}
            style={{ position: 'absolute', top: fit.top, height: fit.height, left: lineX - 12, width: 24, display: 'flex', justifyContent: 'center', outline: 'none', pointerEvents: 'none' }}
          >
            <div style={{ width: 2, height: '100%', background: 'var(--il-fg)', boxShadow: '0 0 0 1px rgba(0,0,0,.35)' }} />
          </div>
        )}
        {fit.width > 0 && !mouse && (
          <div aria-hidden style={{ position: 'absolute', top: fit.top + fit.height / 2 - HANDLE / 2, left: handleX - HANDLE / 2, width: HANDLE, height: HANDLE, borderRadius: '50%', background: 'color-mix(in srgb, var(--il-fg) 92%, transparent)', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,.4)', pointerEvents: 'none' }}>
            <IconArrowsHorizontal size={20} stroke={2.4} />
          </div>
        )}
      </div>
    </div>
  );
}
