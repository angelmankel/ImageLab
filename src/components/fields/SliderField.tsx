/**
 * SliderField (v1)
 * ================
 * A row of preset values, a slider, and a number input with Min / Max / Reset buttons.
 * Dragging updates on a short debounce; buttons and typing commit at once.
 */
import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Slider, Stack, Group, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh, IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { FieldWrapper } from './FieldWrapper';
import { StepperInput } from './StepperInput';

const DEBOUNCE_MS = 50;

/** Preset values along the range, rounded to the step: min, 10/25/50/75/90%, max. */
function generatePresets(min: number, max: number, step: number): number[] {
  const range = max - min;
  const presets: number[] = [min];
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const val = Number((Math.round((min + range * p) / step) * step).toFixed(6));
    if (val > min && val < max && !presets.includes(val)) presets.push(val);
  }
  presets.push(max);
  return presets;
}

export interface SliderFieldProps {
  label?: string;
  description?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** What Reset goes back to. Defaults to `min`. */
  defaultValue?: number;
  /** Override the preset buttons. Pass [] to hide them. */
  presets?: number[];
  disabled?: boolean;
  rightSection?: ReactNode;
}

export function SliderField({
  label, description, value, onChange, min, max, step = 1, defaultValue, presets: presetOverride, disabled, rightSection,
}: SliderFieldProps) {
  const defaultVal = defaultValue ?? min;
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => { if (!isDraggingRef.current) setLocalValue(value); }, [value]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const decimalPlaces = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const presets = useMemo(() => presetOverride ?? generatePresets(min, max, step), [presetOverride, min, max, step]);
  const formatValue = (val: number) => (decimalPlaces > 0 ? val.toFixed(decimalPlaces) : String(val));

  const debouncedOnChange = useCallback((val: number) => {
    setLocalValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(val), DEBOUNCE_MS);
  }, [onChange]);

  const immediateOnChange = useCallback((val: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLocalValue(val);
    onChange(val);
  }, [onChange]);

  return (
    <FieldWrapper label={label} description={description} rightSection={rightSection}>
      <Stack gap={4}>
        {presets.length > 0 && (
          <Group gap={2} justify="flex-start">
            {presets.map((preset) => (
              <Button
                key={preset}
                size="compact-xs"
                variant={localValue === preset ? 'filled' : 'subtle'}
                color="gray"
                onClick={() => immediateOnChange(preset)}
                disabled={disabled}
                style={{ minWidth: 28, padding: '1px 4px', height: 18, fontSize: 10 }}
              >
                {formatValue(preset)}
              </Button>
            ))}
          </Group>
        )}
        <Slider
          value={localValue}
          onChange={(v) => { isDraggingRef.current = true; debouncedOnChange(v); }}
          onChangeEnd={(val) => {
            isDraggingRef.current = false;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            onChange(val);
          }}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          label={(v) => formatValue(v)}
          thumbProps={{ 'aria-label': label }}
          className="touch-pan-y"
        />
        {/* The number box with −/+ at its ends, then v1's Min / Max / Reset. */}
        <Group gap="xs" wrap="nowrap">
          <StepperInput
            value={localValue}
            onChange={immediateOnChange}
            min={min}
            max={max}
            step={step}
            size="xs"
            disabled={disabled}
            aria-label={label}
            style={{ flex: 1 }}
            styles={{ input: { fontWeight: 600, fontSize: 13, textAlign: 'center' } }}
          />
          <Tooltip label="Min">
            <ActionIcon variant="light" color="gray" size="sm" onClick={() => immediateOnChange(min)} disabled={disabled || localValue === min} aria-label="Set to minimum">
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Max">
            <ActionIcon variant="light" color="gray" size="sm" onClick={() => immediateOnChange(max)} disabled={disabled || localValue === max} aria-label="Set to maximum">
              <IconArrowUp size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reset">
            <ActionIcon variant="light" color="gray" size="sm" onClick={() => immediateOnChange(defaultVal)} disabled={disabled} aria-label="Reset">
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </FieldWrapper>
  );
}
