/**
 * The bottom band (Donny 10-21): its own strip under the pages, so nothing ever covers the picture.
 *   portrait   [ left action ]   ◉ HUD   [ right action ]     (+ the map dots under the HUD)
 *   landscape  a column at the right edge: left action on top, the HUD, the right action at the
 *              bottom under the thumb.
 * The sides belong to the top page (`usePhoneBand`); left defaults to "‹ <parent>" (out one layer).
 * The band steps aside while the on-screen keyboard is open.
 */
import type { CSSProperties } from 'react';
import { IconChevronLeft } from '@tabler/icons-react';
import { useKeyboardOpen } from '../keyboard';
import { useLongPress } from '../useLongPress';
import { haptic } from '../haptic';
import { useBandStore, type BandAction } from './band';
import { usePhoneNav, phoneNav } from './navStore';
import { pageTitle } from './pages';
import { Hud } from './Hud';
import { Ring } from './Ring';
import { HudSheets } from './HudSheets';
import { MapDots } from './MapDots';

export const BAND_H = 80;
export const BAND_W = 88;

function Pill({ a, vertical }: { a: BandAction; vertical: boolean }) {
  const hold = useLongPress({ onHold: a.onHold, onTap: () => { if (!a.disabled) { haptic(); a.onClick?.(); } }, disabled: !a.onHold || a.disabled });
  if (a.node) return <>{a.node}</>;
  const tone = a.tone ?? 'default';
  const props = a.onHold ? hold : { onClick: () => { if (!a.disabled) { haptic(); a.onClick?.(); } } };
  const style: CSSProperties = { ...(a.onHold ? hold.style : null) };
  return (
    <button type="button" className="il-band-pill" data-tone={tone} data-vertical={vertical || undefined} disabled={a.disabled} aria-label={a.label}
      {...props} style={style}>
      {a.icon && <span className="il-band-ico">{a.icon}</span>}
      <span className="il-band-label">{a.label}</span>
      {a.badge != null && a.badge !== '' && <span className="il-band-badge">{a.badge}</span>}
    </button>
  );
}

export function PhoneBand({ landscape }: { landscape: boolean }) {
  const stack = usePhoneNav((s) => s.stack);
  const top = stack[stack.length - 1];
  const spec = useBandStore((s) => s.bands[top.key]);
  const kb = useKeyboardOpen();
  const parent = stack.length > 1 ? stack[stack.length - 2] : null;
  const left: BandAction | null = spec?.left !== undefined ? spec.left : parent
    ? { label: pageTitle(parent), icon: <IconChevronLeft size={18} stroke={2.6} />, tone: 'ghost', onClick: () => phoneNav.pop() }
    : null;
  const right = spec?.right ?? null;
  if (kb && !landscape) return <><Ring /><HudSheets /></>;
  return (
    <div className="il-band" data-land={landscape || undefined}>
      <div className="il-band-side" data-side="left">{left && <Pill a={left} vertical={landscape} />}</div>
      <div className="il-band-hud">
        <Hud />
        <MapDots vertical={false} />
      </div>
      <div className="il-band-side" data-side="right">{right && <Pill a={right} vertical={landscape} />}</div>
      <Ring />
      <HudSheets />
    </div>
  );
}
