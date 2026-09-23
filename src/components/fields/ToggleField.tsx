/** ToggleField (v1): label and description on the left, a switch on the right. */
import type { ReactNode } from 'react';
import { Group, Switch, Text } from '@mantine/core';

export interface ToggleFieldProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleField({ label, description, checked, onChange, disabled }: ToggleFieldProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <div>
        <Text size="sm" fw={500}>{label}</Text>
        {description && <Text size="xs" c="dimmed">{description}</Text>}
      </div>
      <Switch checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} disabled={disabled} aria-label={label} />
    </Group>
  );
}
