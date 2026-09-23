import type { ReactNode } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';

interface ToolbarButtonProps {
  icon: ReactNode;
  /** Accessible name. Also the tooltip unless `tooltip` says something longer. */
  label: string;
  tooltip?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Toggled on: filled in the theme colour, as v1's active toolbar buttons were. */
  active?: boolean;
  /** For toggles, so assistive tech hears the state. */
  pressed?: boolean;
  loading?: boolean;
  color?: string;
}

/**
 * v1's ToolbarButtonBase: a subtle md ActionIcon with a tooltip. Every image action above the
 * canvas uses it, so the bar reads as one compact group.
 */
export function ToolbarButton({
  icon, label, tooltip, onClick, disabled = false, active = false, pressed, loading = false, color,
}: ToolbarButtonProps) {
  return (
    <Tooltip label={tooltip ?? label} withinPortal openDelay={300} fz="xs">
      <ActionIcon
        variant={active ? 'filled' : 'subtle'}
        color={color}
        size="md"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
