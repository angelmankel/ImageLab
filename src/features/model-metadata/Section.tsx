import type { ReactNode } from 'react';
import { Stack, Text } from '@mantine/core';

/** Shared labeled section wrapper used throughout the metadata column — v1's dimmed xs label. */
export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={6} component="section">
      <Text size="xs" fw={600} c="dimmed">{label}</Text>
      {children}
    </Stack>
  );
}
