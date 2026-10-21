/**
 * Where you are in the 2D map (Donny 10-21): a tiny indicator under the HUD — the depth as a short
 * column of pips (lit = this layer) and the siblings at this depth as dots (lit = this one; more than
 * 9 = "3 / 14"). It brightens for a moment whenever you move (`flashMap()`), then rests dim.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { usePhoneNav } from './navStore';
import { siblingsOf } from './pages';

const useFlash = create<{ at: number }>(() => ({ at: 0 }));
export function flashMap(): void { useFlash.setState({ at: Date.now() }); }

export function MapDots({ vertical = false }: { vertical?: boolean }) {
  const stack = usePhoneNav((s) => s.stack);
  const at = useFlash((s) => s.at);
  const [lit, setLit] = useState(false);
  const depth = stack.length - 1;
  const sib = siblingsOf(stack[depth]);
  const key = `${depth}:${sib?.index ?? 0}`;

  useEffect(() => { flashMap(); }, [key]);
  useEffect(() => {
    if (!at) return;
    setLit(true);
    const t = window.setTimeout(() => setLit(false), 1100);
    return () => clearTimeout(t);
  }, [at]);

  const pips = Math.min(5, Math.max(depth + 1, 1));
  return (
    <div aria-label={`Layer ${depth + 1}${sib ? `, ${sib.index + 1} of ${sib.count}` : ''}`} role="img" className="il-map" data-lit={lit || undefined}
      style={{ flexDirection: vertical ? 'column' : 'row' }}>
      <span className="il-map-depth">
        {Array.from({ length: pips }, (_, i) => <i key={i} data-on={i === Math.min(depth, 4) || undefined} />)}
      </span>
      {sib && (sib.count <= 9
        ? <span className="il-map-sibs" style={{ flexDirection: vertical ? 'column' : 'row' }}>{Array.from({ length: sib.count }, (_, i) => <i key={i} data-on={i === sib.index || undefined} />)}</span>
        : <span className="il-map-count">{sib.index + 1} / {sib.count}</span>)}
    </div>
  );
}
