/** NumberField (v1): a labelled number input without a slider. */
import type { ReactNode } from 'react';
import { StepperInput } from './StepperInput';
import { FieldWrapper } from './FieldWrapper';

export interface NumberFieldProps {
  label?: string;
  description?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberField({ label, description, value, onChange, min, max, step = 1, disabled }: NumberFieldProps) {
  return (
    <FieldWrapper label={label} description={description}>
      <StepperInput value={value} onChange={onChange} min={min} max={max} step={step} disabled={disabled} aria-label={label}
        styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
    </FieldWrapper>
  );
}
