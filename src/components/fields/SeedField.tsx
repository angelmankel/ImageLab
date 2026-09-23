/**
 * SeedField (v1): the seed, a randomize button beside it, and — this app's addition — the Auto
 * switch that rolls a new seed for every generation.
 */
import { ActionIcon, Group, Switch, Text, Tooltip } from '@mantine/core';
import { StepperInput } from './StepperInput';
import { IconDice5 } from '@tabler/icons-react';
import { FieldWrapper } from './FieldWrapper';

const MAX_SEED = 0xFFFFFFFF;

export interface SeedFieldProps {
  value: number;
  onChange: (v: number) => void;
  auto: boolean;
  onAutoChange: (v: boolean) => void;
  label?: string;
}

export function SeedField({ value, onChange, auto, onAutoChange, label = 'Seed' }: SeedFieldProps) {
  return (
    <FieldWrapper
      label={label}
      rightSection={
        <Tooltip label="Pick a new seed for every generation">
          <Switch size="xs" checked={auto} onChange={(e) => onAutoChange(e.currentTarget.checked)} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
        </Tooltip>
      }
    >
      <Group gap="xs" wrap="nowrap">
        <StepperInput value={value} onChange={onChange} min={0} max={MAX_SEED} step={1} style={{ flex: 1 }} aria-label="Seed" styles={{ input: { textAlign: 'center' } }} />
        <Tooltip label="Randomize seed">
          <ActionIcon variant="light" size="lg" onClick={() => onChange(Math.floor(Math.random() * MAX_SEED))} aria-label="Randomize seed">
            <IconDice5 size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </FieldWrapper>
  );
}
