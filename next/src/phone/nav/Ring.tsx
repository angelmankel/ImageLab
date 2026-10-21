/**
 * The HUD ring (Donny 10-21): a tap on the circle opens the globals in two arcs over a dim page;
 * the circle itself is Home. Tap-then-tap, or press-drag-release, picks in one move. Tap outside
 * (or Esc) closes. Every target is 52 px.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { T } from '~/theme/tokens';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { haptic } from '../haptic';
import { closeRing, useHud } from './hudStore';
import { RING_ITEM, ringLayout } from './hudLogic';
import { useRingItems, type RingItem } from './ringItems';

export function useRingSpots() {
  const at = useHud((s) => s.at);
  const land = usePhoneLandscape();
  const items = useRingItems();
  const w = typeof window !== 'undefined' ? document.documentElement.clientWidth : 400;
  const h = typeof window !== 'undefined' ? document.documentElement.clientHeight : 800;
  const lay = at ? ringLayout(items.inner.length, items.outer.length, at.x, at.y, w, h, land) : { inner: [], outer: [] };
  return { items: [...items.inner, ...items.outer], spots: [...lay.inner, ...lay.outer], at };
}

export function runRingItem(it: RingItem | undefined) {
  if (!it || it.disabled) return;
  haptic('tick');
  closeRing();
  it.run();
}

export function Ring() {
  const open = useHud((s) => s.open);
  const hover = useHud((s) => s.hover);
  const { items, spots, at } = useRingSpots();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRing(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !at) return null;
  return createPortal(
    <div className="il-ring" style={{ zIndex: T.z.sheet - 1 }} onClick={closeRing} role="presentation">
      <div className="il-ring-scrim" />
      <div role="menu" aria-label="Go to" style={{ position: 'fixed', left: at.x, top: at.y, width: 0, height: 0 }}>
        {items.map((it, i) => {
          const s = spots[i];
          if (!s) return null;
          return (
            <button key={it.id} type="button" role="menuitem" disabled={it.disabled} aria-label={it.label}
              className="il-ring-item" data-hot={hover === i || undefined} data-primary={it.hot || undefined}
              onClick={(e) => { e.stopPropagation(); runRingItem(it); }}
              style={{ left: s.x - RING_ITEM / 2, top: s.y - RING_ITEM / 2, width: RING_ITEM, height: RING_ITEM }}>
              {it.icon}
              {it.badge && <span className="il-ring-badge">{it.badge}</span>}
              <span className="il-ring-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
