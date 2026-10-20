/**
 * The tooltip (item 26): near-instant (60ms), a 90ms fade, the dark `.il-tip` card. Two uses:
 *   <Tip label="Fullscreen" keys="F">…</Tip>      a button's name (+ its key)
 *   <Tip hint="steps">…</Tip>                      a parameter: its name + hint text from the
 *                                                  hints list; with hints off, the name alone.
 * Both at once: the label, then the hint under it. No label and no hint → the child as is.
 */
import type { ReactNode } from 'react';
import { Tooltip, type TooltipProps } from '@mantine/core';
import { T } from '~/theme/tokens';
import { hintOf, useHints } from './hints';

/** ms before a tooltip shows (item 26: near instant). The Mantine theme default matches. */
export const TIP_DELAY = 60;

export function Tip({ label, hint, keys, children, position, disabled, multiline, w, withinPortal = true }: {
  label?: ReactNode; hint?: string; keys?: string; children: ReactNode;
  position?: TooltipProps['position']; disabled?: boolean; multiline?: boolean; w?: number | string; withinPortal?: boolean;
}) {
  const enabled = useHints((s) => s.enabled);
  const overrides = useHints((s) => s.overrides);
  const meta = hint ? hintOf(hint, overrides) : null;
  const head = label ?? meta?.label;
  const body = enabled && meta?.hint ? meta.hint : null;
  if (disabled || (head == null && body == null)) return <>{children}</>;
  return (
    <Tooltip
      label={<>
        {head}{keys && <kbd className="il-tip-key">{keys}</kbd>}
        {body && <span className="il-tip-hint">{body}</span>}
      </>}
      position={position}
      multiline={multiline ?? !!body}
      w={w ?? (body ? 260 : undefined)}
      withinPortal={withinPortal}
      zIndex={T.z.confirm + 10}
      classNames={{ tooltip: 'il-tip' }}
      openDelay={TIP_DELAY}
      closeDelay={0}
      transitionProps={{ transition: 'fade', duration: 90 }}
      events={{ hover: true, focus: true, touch: false }}
    >
      {children}
    </Tooltip>
  );
}
