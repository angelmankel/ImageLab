/** A segmented choice, sized for fingers; every option can carry an icon. */
import type { ReactNode } from 'react';
import { SegmentedControl } from '@mantine/core';

export interface SegmentedOption<T extends string> { value: T; label: ReactNode; icon?: ReactNode }

export function Segmented<T extends string>({ value, onChange, options, size = 'sm', fullWidth = true, ariaLabel }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly SegmentedOption<T>[];
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  return (
    <SegmentedControl
      size={size}
      fullWidth={fullWidth}
      value={value}
      onChange={v => onChange(v as T)}
      aria-label={ariaLabel}
      data={options.map(o => ({
        value: o.value,
        label: (
          <span className="flex items-center justify-center gap-1.5">
            {o.icon}
            <span>{o.label}</span>
          </span>
        ),
      }))}
    />
  );
}
