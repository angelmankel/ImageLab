import { NumberInput as MNumberInput } from '@mantine/core';
import { cn } from '@/lib/cn';

type Props = {
  value: number;
  onValueChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  ariaLabel?: string;
  size?: 'xs' | 'sm';
};

/**
 * The v1 number input (Mantine). Clamps on blur rather than per keystroke, so typing a partial
 * value like "1." is not reset under the cursor.
 */
export function NumberInput({ value, onValueChange, step = 1, min, max, align = 'right', className, ariaLabel, size = 'sm' }: Props) {
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return (
    <MNumberInput
      value={value}
      onChange={v => { const n = typeof v === 'number' ? v : Number(v); if (Number.isFinite(n) && v !== '') onValueChange(n); }}
      step={step}
      min={min}
      max={max}
      clampBehavior="blur"
      decimalScale={decimals || undefined}
      size={size}
      aria-label={ariaLabel}
      className={cn('min-w-0 flex-1', className)}
      styles={{ input: { textAlign: align, fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }}
    />
  );
}
