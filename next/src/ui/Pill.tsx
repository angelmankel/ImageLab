import type { CSSProperties, ReactNode } from 'react';

/** A top-bar / toolbar pill: 36 high, elev grey, 999 radius. `onClick` makes it a button. */
export function Pill({ children, onClick, style, title, active }: {
  children: ReactNode; onClick?: () => void; style?: CSSProperties; title?: string; active?: boolean;
}) {
  const base: CSSProperties = {
    height: 36, padding: '0 14px', borderRadius: 999, border: 0,
    background: active ? 'var(--il-ember-soft)' : 'var(--il-elev)',
    color: active ? 'var(--il-ember-hi)' : 'var(--il-fg2)',
    fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    cursor: onClick ? 'pointer' : 'default', ...style,
  };
  return onClick
    ? <button type="button" onClick={onClick} title={title} style={base}>{children}</button>
    : <div title={title} style={base}>{children}</div>;
}

/** The small count badge inside a pill ("Queue 2"). */
export function Count({ n, tone = 'ember' }: { n: number; tone?: 'ember' | 'ok' | 'muted' }) {
  const bg = tone === 'ember' ? 'var(--il-ember)' : tone === 'ok' ? 'var(--il-ok)' : 'var(--il-line-strong)';
  const fg = tone === 'muted' ? 'var(--il-fg2)' : 'var(--il-bg)';
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{n}</span>;
}

/** The status dot (green = online). */
export function Dot({ color = 'var(--il-ok)', size = 8 }: { color?: string; size?: number }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: color, flex: 'none' }} />;
}
