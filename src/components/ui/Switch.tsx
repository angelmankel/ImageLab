import { Switch as MSwitch } from '@mantine/core';

type Props = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
};

/** The v1 switch (Mantine). */
export function Switch({ checked, onCheckedChange, size = 'md', ariaLabel, className }: Props) {
  return (
    <MSwitch
      checked={checked}
      onChange={e => onCheckedChange(e.currentTarget.checked)}
      size={size === 'sm' ? 'xs' : 'sm'}
      aria-label={ariaLabel}
      className={className}
      styles={{ track: { cursor: 'pointer' } }}
    />
  );
}
