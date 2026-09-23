/**
 * A strength or ratio control that is easy on a trackpad: one-click value chips, a full-width
 * slider with a large thumb, and a number box whose −/+ buttons repeat while held.
 */
import { Button, Group, Slider, Stack, Text } from '@mantine/core';
import { StepperInput } from './StepperInput';

export function StrengthControl({ label, value, onChange, min, max, step, chips, color = 'grape' }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; chips: number[]; color?: string;
}) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed">{label}</Text>
        <Group gap={2} wrap="nowrap">
          {chips.map((c) => (
            <Button key={c} size="compact-xs" color="gray" variant={Math.abs(value - c) < 1e-6 ? 'filled' : 'subtle'}
              onClick={() => onChange(c)} style={{ minWidth: 28, paddingInline: 4 }} aria-label={`${label} ${c}`}>
              {c}
            </Button>
          ))}
        </Group>
      </Group>
      <Group gap="sm" wrap="nowrap">
        <Slider
          value={value} onChange={onChange} min={min} max={max} step={step} size="md" thumbSize={18} color={color}
          label={null} thumbProps={{ 'aria-label': label }} className="touch-pan-y" style={{ flex: 1 }}
        />
        <StepperInput value={value} onChange={onChange} min={min} max={max} step={step} size="xs" w={104}
          aria-label={`${label} value`} styles={{ input: { textAlign: 'center', fontWeight: 600 } }} />
      </Group>
    </Stack>
  );
}
