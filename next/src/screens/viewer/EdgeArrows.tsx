/**
 * List-2 item 22 (+ item 30's look): previous / next as compact round frosted buttons floating at
 * the picture's left and right edges — no full-height gutters. Shown on hover (`show`), always on
 * touch. Swap for the shared `NavArrows` (~/ui, base agent) when it lands.
 */
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export function EdgeArrows({ onPrev, onNext, show, size = 44 }: { onPrev: () => void; onNext: () => void; show: boolean; size?: number }) {
  const btn = (side: 'left' | 'right') => (
    <button type="button" className="il-btn" aria-label={side === 'left' ? 'Previous' : 'Next'} title={side === 'left' ? 'Previous (←)' : 'Next (→)'}
      onClick={(e) => { e.stopPropagation(); if (side === 'left') onPrev(); else onNext(); }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: '50%', [side]: 14, width: size, height: size, marginTop: -size / 2, borderRadius: '50%', border: 0, zIndex: 2,
        display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--il-fg)',
        background: 'color-mix(in srgb, var(--il-elev) 62%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 2px 12px rgba(0,0,0,.35)', opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none',
        transition: 'opacity calc(.18s * var(--il-motion, 1)) ease',
      }}>
      {side === 'left' ? <IconChevronLeft size={22} stroke={2.4} /> : <IconChevronRight size={22} stroke={2.4} />}
    </button>
  );
  return <>{btn('left')}{btn('right')}</>;
}
