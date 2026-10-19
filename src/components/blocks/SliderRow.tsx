/**
 * A compact one-line slider: label, track, value. For the few key settings simple mode keeps on
 * screen; the full `SliderField` (presets, min/max/reset) stays for the advanced sections.
 */
import { Slider } from '@mantine/core';

export function SliderRow({ label, value, min, max, step = 1, onChange, format, disabled }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const shown = format ? format(value) : String(value);
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="w-[72px] shrink-0 truncate text-[13px] font-medium text-fg-secondary">{label}</span>
      <Slider
        value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={onChange} label={null} size="md" thumbSize={18}
        thumbProps={{ 'aria-label': label }}
        className="touch-pan-y min-w-0 flex-1"
      />
      <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-fg-primary">{shown}</span>
    </div>
  );
}
