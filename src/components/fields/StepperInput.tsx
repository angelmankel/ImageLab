/**
 * A number input with − and + buttons at its ends, one step per press. Holding a button repeats,
 * speeding up after a moment, so a long way is one hold rather than many taps. The buttons are
 * inside the input's sections, so the control keeps the width of a plain number input.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { ActionIcon, NumberInput, type NumberInputProps } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';

export interface StepperInputProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'leftSection' | 'rightSection'> {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  style?: CSSProperties;
}

const FIRST_REPEAT_MS = 400;
const REPEAT_MS = 70;

export function StepperInput({ value, onChange, step = 1, min, max, disabled, size = 'sm', styles, ...rest }: StepperInputProps) {
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const latest = useRef(value);
  latest.current = value;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => stop, []);

  const nudge = (dir: 1 | -1) => {
    let v = Number((latest.current + dir * step).toFixed(decimals));
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    latest.current = v;
    onChange(v);
  };
  const hold = (dir: 1 | -1) => {
    nudge(dir);
    const repeat = () => { nudge(dir); timer.current = setTimeout(repeat, REPEAT_MS); };
    timer.current = setTimeout(repeat, FIRST_REPEAT_MS);
  };

  const button = (dir: 1 | -1) => {
    const atEnd = dir < 0 ? min != null && value <= min : max != null && value >= max;
    return (
      <ActionIcon
        variant="subtle"
        color="gray"
        size={size === 'xs' ? 'sm' : 'md'}
        disabled={disabled || atEnd}
        aria-label={dir < 0 ? 'Decrease' : 'Increase'}
        onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); hold(dir); } }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudge(dir); } }}
      >
        {dir < 0 ? <IconMinus size={14} /> : <IconPlus size={14} />}
      </ActionIcon>
    );
  };

  return (
    <NumberInput
      {...rest}
      size={size}
      value={value}
      onChange={(v) => { if (v !== '' && Number.isFinite(Number(v))) onChange(Number(v)); }}
      min={min}
      max={max}
      step={step}
      clampBehavior="blur"
      decimalScale={decimals}
      disabled={disabled}
      leftSection={button(-1)}
      rightSection={button(1)}
      leftSectionPointerEvents="all"
      rightSectionPointerEvents="all"
      styles={styles}
    />
  );
}
