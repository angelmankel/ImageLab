import { Tooltip } from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';

/** Kept for the call sites that wrap the app in it; Mantine tooltips need no provider. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type TipProps = {
  label: string;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
};

/** The v1 tooltip (Mantine): portalled and collision-aware, with the same open delay as before. */
export function Tip({ label, children, side = 'top', className }: TipProps) {
  return (
    <Tooltip label={label} position={side} openDelay={400} withinPortal className={className} fz="xs">
      {children}
    </Tooltip>
  );
}
