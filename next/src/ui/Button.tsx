/**
 * THE button (items 33 + 44 + 38). One shape for every text button in the app: fixed slot
 * padding (an icon or a ▾ caret sits 3px closer to the edge than text, icon-only is square),
 * height by `size` (sm 30 · md 36 · lg 44 — lg is the phone's), radius from the ONE rounding
 * token (`btnRadius`), the `.il-btn` hover / press feedback and the press flash. Forwards its
 * ref, so it can be a `Menu.Target` / `Popover.Target` directly.
 *
 *   tone: elev (default, the top-bar pill) · card · primary (ember) · light (white) · outline ·
 *         ghost · danger.   `on` = ember tint (a toggle that is on), `tooltip` = label on hover.
 */
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { btnRadius } from '~/theme/tokens';
import { Tip } from './Tip';

export type ButtonTone = 'elev' | 'card' | 'primary' | 'light' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const BTN_HEIGHT: Record<ButtonSize, number> = { sm: 30, md: 36, lg: 44 };
/** Text padding per size; an icon / caret slot is `ICON_TIGHTEN` less. */
const TEXT_PAD: Record<ButtonSize, number> = { sm: 11, md: 14, lg: 18 };
const ICON_TIGHTEN = 3;
const FONT: Record<ButtonSize, number> = { sm: 11, md: 12, lg: 13 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  children?: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** A leading icon (gets the tighter slot). */
  icon?: ReactNode;
  /** A trailing ▾ (true) or any trailing node (gets the tighter slot). */
  caret?: boolean | ReactNode;
  /** Toggle state: ember tint + aria-pressed. */
  on?: boolean;
  /** Exact height, when the row needs one (overrides `size`'s). */
  h?: number;
  /** Full width (phone rows). */
  grow?: boolean;
  /** Shown as the tooltip (and as aria-label when there is no text). */
  tooltip?: ReactNode;
  /** A hint id (item 26): the tooltip shows that parameter's name + hint. */
  hint?: string;
  /** Tooltip position. */
  tipPos?: 'top' | 'bottom' | 'left' | 'right';
}

/** The colours of a tone (`on` wins). */
export function toneStyle(tone: ButtonTone, on?: boolean): CSSProperties {
  if (on) return { background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', boxShadow: 'inset 0 0 0 1px var(--il-ember-line)' };
  switch (tone) {
    case 'primary': return { background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800 };
    case 'light': return { background: 'var(--il-fg)', color: 'var(--il-bg)', fontWeight: 800 };
    case 'card': return { background: 'var(--il-card-on)', color: 'var(--il-fg)' };
    case 'outline': return { background: 'transparent', color: 'var(--il-fg)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong)' };
    case 'ghost': return { background: 'transparent', color: 'var(--il-fg2)' };
    case 'danger': return { background: 'color-mix(in srgb, var(--il-err) 14%, transparent)', color: 'var(--il-err)' };
    default: return { background: 'var(--il-elev)', color: 'var(--il-fg2)' };
  }
}

/**
 * A caller's style without its `undefined` keys: `{ padding: cond ? '0 11px' : undefined }`
 * must keep the button's own padding, not wipe it (that was item 33's "text touches the edge").
 */
export function definedOnly(style?: CSSProperties): CSSProperties | undefined {
  if (!style) return style;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) if (v !== undefined) out[k] = v;
  return out as CSSProperties;
}

/** Remember where a press landed so the flash starts there. */
export function flashAt(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  el.style.setProperty('--px', `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
  el.style.setProperty('--py', `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, tone = 'elev', size = 'md', icon, caret, on, h, grow, tooltip, hint, tipPos, style, className, onMouseDown, disabled, ...rest }, ref,
) {
  const height = h ?? BTN_HEIGHT[size];
  const iconOnly = !children && children !== 0;
  const pad = TEXT_PAD[size];
  const padL = icon ? pad - ICON_TIGHTEN : pad;
  const padR = caret ? pad - ICON_TIGHTEN : pad;
  const cls = ['il-btn', 'il-btn-flash', tone === 'primary' && 'il-btn-primary', tone === 'ghost' && !on && 'il-btn-ghost', className].filter(Boolean).join(' ');
  const s: CSSProperties = {
    height, minWidth: iconOnly ? height : undefined, width: iconOnly ? height : grow ? '100%' : undefined,
    padding: iconOnly ? 0 : `0 ${padR}px 0 ${padL}px`,
    borderRadius: btnRadius(height), border: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: size === 'sm' ? 6 : 8,
    fontWeight: 700, fontSize: FONT[size], whiteSpace: 'nowrap', minHeight: 0,
    opacity: disabled ? 0.45 : 1,
    ...toneStyle(tone, on),
    ...definedOnly(style),
  };
  const label = typeof tooltip === 'string' ? tooltip : undefined;
  const btn = (
    <button
      ref={ref}
      type="button"
      className={cls}
      aria-pressed={on}
      aria-label={iconOnly ? label ?? rest['aria-label'] : rest['aria-label']}
      disabled={disabled}
      onMouseDown={(e) => { flashAt(e); onMouseDown?.(e); }}
      style={s}
      {...rest}
    >
      {icon}
      {children}
      {caret === true ? <span aria-hidden style={{ color: on ? 'var(--il-ember-hi)' : 'var(--il-muted)', fontSize: 11, opacity: 0.9 }}>▾</span> : caret}
    </button>
  );
  return tooltip || hint ? <Tip label={tooltip} hint={hint} position={tipPos}>{btn}</Tip> : btn;
});
