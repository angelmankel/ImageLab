import type { ReactNode } from 'react';
import { Group, Stack, Text } from '@mantine/core';

/**
 * One labelled setting, laid out like v1's FieldWrapper: the label on top (with an optional
 * control at its right), then the control row. The row stays a flex line so a slider and its
 * value readout can still sit side by side.
 */
export function Field({ label, children, rightSection }: { label: string; children: ReactNode; rightSection?: ReactNode }) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
        <Text size="sm" fw={500} component="label">{label}</Text>
        {rightSection}
      </Group>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </Stack>
  );
}
