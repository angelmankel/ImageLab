import { ActionIcon } from '@mantine/core';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'ghost' | 'soft';
type ToggleState = 'on' | 'off';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  children: ReactNode;
  variant?: Variant;
  /**
   * Toggle state for on/off buttons. "on" renders filled in the theme colour, as a v1 active
   * ActionIcon did. Leave `undefined` for a stateless icon button (most buttons).
   */
  state?: ToggleState;
};

/** The v1 icon button: a Mantine ActionIcon — subtle grey, filled when switched on. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { children, variant = 'soft', state, className, ...rest },
  ref,
) {
  const on = state === 'on';
  return (
    <ActionIcon
      ref={ref}
      data-state={state}
      variant={on ? 'filled' : variant === 'soft' ? 'default' : 'subtle'}
      color={on ? undefined : 'gray'}
      size="lg"
      className={className}
      {...rest}
    >
      {children}
    </ActionIcon>
  );
});
