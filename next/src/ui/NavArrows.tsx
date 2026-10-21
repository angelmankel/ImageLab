/**
 * THE previous / next arrows (FIXLIST-2 item 30), one for every viewer, gallery and carousel: two
 * compact round frosted buttons floating at the left and right edges of the picture, vertically
 * centred — never full-height side strips eating the picture's width. Render it inside the
 * picture's `position: relative` box.
 *
 *   <NavArrows onPrev={…} onNext={…} canPrev={i > 0} canNext={i < n - 1} />
 *
 * - Shown while the pointer is over that box (or a button has keyboard focus), always on touch
 *   screens; `show` forces it (e.g. a viewer's idle timer). An end with nowhere to go hides its arrow.
 * - A click never reaches the picture under it (no zoom / open / swipe start).
 * - ← / → stay the caller's keys (the viewers already bind them); the tooltips name them.
 */
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { Tip } from './Tip';

export function NavArrows({ onPrev, onNext, canPrev = true, canNext = true, show, size, inset = 12, zIndex = 2 }: {
  onPrev: () => void; onNext: () => void;
  canPrev?: boolean; canNext?: boolean;
  /** Force visible (true) or hidden (false); default = on hover, always on touch. */
  show?: boolean;
  /** Button size (default 40, 44 on the phone). */
  size?: number;
  /** Distance from the box's edge. */
  inset?: number;
  zIndex?: number;
}) {
  const phone = useIsPhone();
  const s = size ?? (phone ? 44 : 40);
  const btn = (side: 'left' | 'right') => {
    const can = side === 'left' ? canPrev : canNext;
    const label = side === 'left' ? 'Previous' : 'Next';
    return (
      <Tip label={label} keys={side === 'left' ? '←' : '→'} position={side === 'left' ? 'right' : 'left'} disabled={!can}>
        <button type="button" className="il-nav" aria-label={label} disabled={!can}
          data-show={show === undefined ? undefined : String(show)}
          onClick={(e) => { e.stopPropagation(); if (!can) return; if (side === 'left') onPrev(); else onNext(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          data-no-swipe=""
          style={{ position: 'absolute', top: '50%', [side]: inset, width: s, height: s, marginTop: -s / 2, zIndex }}>
          {side === 'left' ? <IconChevronLeft size={Math.round(s * 0.5)} stroke={2.4} /> : <IconChevronRight size={Math.round(s * 0.5)} stroke={2.4} />}
        </button>
      </Tip>
    );
  };
  return <>{btn('left')}{btn('right')}</>;
}
