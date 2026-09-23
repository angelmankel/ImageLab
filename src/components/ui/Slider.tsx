import { Slider as MSlider } from '@mantine/core';
import { cn } from '@/lib/cn';

type Props = {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
};

/** The v1 slider (Mantine). Only the thumb captures touch, so the row still scrolls on a phone. */
export function Slider({ value, onValueChange, min, max, step = 1, className, ariaLabel }: Props) {
  return (
    <MSlider
      value={value}
      onChange={onValueChange}
      min={min}
      max={max}
      step={step}
      label={null}
      size="sm"
      thumbProps={{ 'aria-label': ariaLabel }}
      className={cn('min-w-0 flex-1 touch-pan-y', className)}
    />
  );
}
