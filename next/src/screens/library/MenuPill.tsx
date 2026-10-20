/**
 * Library (rule 12): a 36-high pill button that can be a Mantine `Menu.Target`. Now a thin
 * wrapper over the shared `ui/Button` (item 33: one padding / rounding for every button):
 * `on` = ember tint, `outline` = the board's Select button, `light` = brighter text.
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Button } from '~/ui/Button';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; outline?: boolean; light?: boolean; h?: number };

export const MenuPill = forwardRef<HTMLButtonElement, Props>(function MenuPill({ on, outline, light, h = 36, style, children, title, ...rest }, ref) {
  return (
    <Button ref={ref} h={h} on={on} tone={outline ? 'outline' : 'elev'} aria-label={rest['aria-label'] ?? title}
      style={{ minWidth: 0, gap: 7, ...(light && !on && !outline ? { color: 'var(--il-fg)' } : null), ...style }} {...rest}>
      {children}
    </Button>
  );
});
