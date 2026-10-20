/**
 * Library (rule 12): a 36-high pill button that can be a Mantine `Menu.Target` (it forwards its
 * ref; `ui/Pill` does not). Looks like `ui/Pill`; `on` = ember tint, `outline` = the board's
 * Select button (transparent with a strong hairline).
 */
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; outline?: boolean; light?: boolean; h?: number };

export const MenuPill = forwardRef<HTMLButtonElement, Props>(function MenuPill({ on, outline, light, h = 36, style, children, ...rest }, ref) {
  const s: CSSProperties = {
    height: h, padding: '0 14px', borderRadius: 999, flex: 'none',
    border: outline ? `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-strong)'}` : 0,
    background: on ? 'var(--il-ember-soft)' : outline ? 'transparent' : 'var(--il-elev)',
    color: on ? 'var(--il-ember-hi)' : light ? 'var(--il-fg)' : 'var(--il-fg2)',
    fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', cursor: 'pointer', minWidth: 0,
    ...style,
  };
  return <button ref={ref} type="button" {...rest} style={s}>{children}</button>;
});
