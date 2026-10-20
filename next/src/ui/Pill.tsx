import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { btnRadius } from '~/theme/tokens';
import { definedOnly, flashAt } from './Button';

/**
 * A top-bar / toolbar pill: 36 high, elev grey, rounded by the one button token (item 33).
 * `onClick` makes it a button (with the `.il-btn` feedback and a forwarded ref, so it can be a
 * Menu / Popover target); otherwise a plain chip of text. `icon` / `caret` get the tighter slot.
 */
export const Pill = forwardRef<HTMLButtonElement, {
  children: ReactNode; onClick?: () => void; style?: CSSProperties; title?: string; active?: boolean; icon?: ReactNode; caret?: boolean; h?: number;
  'aria-label'?: string; 'aria-expanded'?: boolean; 'aria-haspopup'?: boolean | 'menu' | 'dialog' | 'listbox';
}>(function Pill({ children, onClick, style, title, active, icon, caret, h = 36, ...aria }, ref) {
  const base: CSSProperties = {
    height: h, padding: `0 ${caret ? 11 : 14}px 0 ${icon ? 11 : 14}px`, borderRadius: btnRadius(h), border: 0, flex: 'none',
    background: active ? 'var(--il-ember-soft)' : 'var(--il-elev)',
    color: active ? 'var(--il-ember-hi)' : 'var(--il-fg2)',
    boxShadow: active ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined,
    fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    cursor: onClick ? 'pointer' : 'default', ...definedOnly(style),
  };
  const body = <>{icon}{children}{caret && <span aria-hidden style={{ color: 'var(--il-muted)', fontSize: 11 }}>▾</span>}</>;
  return onClick
    ? <button ref={ref} type="button" onClick={onClick} title={title} className="il-btn il-btn-flash" onMouseDown={flashAt} aria-pressed={active} style={base} {...aria}>{body}</button>
    : <div title={title} style={base} aria-label={aria['aria-label']}>{body}</div>;
});

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
