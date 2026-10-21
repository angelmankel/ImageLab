/**
 * The circle HUD (Donny 10-21), bottom centre in its own band (right-edge column in landscape).
 * - tap = open the globals ring (./Ring); with the ring open, a tap on the circle = Home (the
 *   origin of the map) and closes it.
 * - press and drag onto an item, release = that item (one move).
 * - its ring = the progress of the running job; the badge = jobs still to finish.
 */
import { useRef } from 'react';
import { IconHomeFilled } from '@tabler/icons-react';
import { useQueue } from '~/app/queue';
import { toCssPx } from '~/theme/uiScale';
import { LogoMark } from '~/app/logo';
import { badgeText, progressFraction } from '~/screens/phone/phoneLogic';
import { haptic } from '../haptic';
import { closeRing, useHud } from './hudStore';
import { ringHit } from './hudLogic';
import { runRingItem, useRingSpots } from './Ring';
import { phoneNav } from './navStore';

export const HUD_SIZE = 64;

export function Hud() {
  const { rows, running } = useQueue();
  const open = useHud((s) => s.open);
  const { items, spots } = useRingSpots();
  const latest = useRef({ items, spots });
  latest.current = { items, spots };
  const press = useRef<{ id: number; x: number; y: number; wasOpen: boolean; moved: boolean } | null>(null);
  const frac = running ? progressFraction(running.progress) : null;
  const badge = badgeText(rows.length);
  const pct = frac != null ? Math.max(4, Math.round(frac * 100)) : running ? 100 : 0;

  const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: toCssPx(r.left + r.width / 2), y: toCssPx(r.top + r.height / 2) };
  };

  return (
    <button type="button" className="il-hud" data-open={open || undefined} data-busy={running ? '' : undefined}
      aria-label={open ? 'Home' : 'Open the menu'} aria-expanded={open}
      style={{ ['--il-hud-pct' as string]: `${pct}%` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, wasOpen: useHud.getState().open, moved: false };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) {
          p.moved = true;
          if (!useHud.getState().open) { haptic('hold'); useHud.setState({ open: true, drag: true, hover: -1, at: centre(e.currentTarget) }); }
          else useHud.setState({ drag: true });
        }
        const h = useHud.getState();
        if (!p.moved || !h.open || !h.at) return;
        const i = ringHit(latest.current.spots, toCssPx(e.clientX) - h.at.x, toCssPx(e.clientY) - h.at.y);
        if (i !== h.hover) { useHud.setState({ hover: i }); if (i >= 0) haptic('tick'); }
      }}
      onPointerUp={(e) => {
        const p = press.current;
        press.current = null;
        if (!p || p.id !== e.pointerId) return;
        const h = useHud.getState();
        if (p.moved) {
          if (h.hover >= 0) runRingItem(latest.current.items[h.hover]);
          else useHud.setState({ drag: false, hover: -1 }); // let go on nothing: the ring stays, tap to pick
          return;
        }
        if (p.wasOpen) { closeRing(); haptic('tick'); phoneNav.root(); return; }
        haptic('tick');
        useHud.setState({ open: true, drag: false, hover: -1, at: centre(e.currentTarget) });
      }}
      onPointerCancel={() => { press.current = null; }}
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (useHud.getState().open) { closeRing(); phoneNav.root(); }
        else useHud.setState({ open: true, drag: false, hover: -1, at: centre(e.currentTarget) });
      }}
    >
      <span aria-hidden className="il-hud-ring" />
      <span aria-hidden className="il-hud-disc">{open ? <IconHomeFilled size={24} /> : <LogoMark size={26} />}</span>
      {badge && !open && <span className="il-hud-badge">{badge}</span>}
    </button>
  );
}
