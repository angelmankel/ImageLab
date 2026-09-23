/**
 * FieldWrapper (v1)
 * =================
 * A field's label on top — with an optional control on the right of it — then an optional
 * description, then the field itself.
 */
import type { ReactNode } from 'react';
import { Group, Stack, Text } from '@mantine/core';

interface FieldWrapperProps {
  label?: string;
  description?: ReactNode;
  children: ReactNode;
  /** Content on the right side of the label row. */
  rightSection?: ReactNode;
}

export function FieldWrapper({ label, description, children, rightSection }: FieldWrapperProps) {
  if (!label) return <>{children}</>;
  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm" fw={500}>{label}</Text>
        {rightSection}
      </Group>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {children}
    </Stack>
  );
}
