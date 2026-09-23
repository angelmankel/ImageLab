/**
 * One numeric parameter, in the v1 look.
 *
 * A thin adapter over the v1 `SliderField` (preset row, slider, exact-value input with Min / Max /
 * Reset), so every numeric row in the app reads the same. The props are the ones this row always
 * had; `format` becomes a readout beside the label, since the input itself shows the plain number.
 */
import type { ReactNode } from 'react';
import { Stack, Text } from '@mantine/core';
import { SliderField } from '@/components/fields/SliderField';

export interface ParamRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** How the value reads. Defaults to the plain number. */
  format?: (v: number) => string;
  /** The value the reset button goes back to. Defaults to `min`. */
  defaultValue?: number;
  /** Short note under the row — units, a warning, a computed result. */
  hint?: ReactNode;
  /** Dimmed and non-interactive, for a bypassed pass. */
  disabled?: boolean;
  /** Preset buttons above the slider. Defaults to points along the range; [] hides them. */
  presets?: number[];
}

export function ParamRow({
  label, value, onChange, min, max, step = 1, format, defaultValue, hint, disabled, presets,
}: ParamRowProps) {
  const field = (
    <SliderField
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      defaultValue={defaultValue}
      disabled={disabled}
      presets={presets}
      rightSection={format ? <Text size="sm" c="dimmed" className="tabular-nums">{format(value)}</Text> : undefined}
    />
  );
  if (!hint) return field;
  return (
    <Stack gap={4}>
      {field}
      <Text size="xs" c="dimmed">{hint}</Text>
    </Stack>
  );
}
