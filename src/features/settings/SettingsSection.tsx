import type { ReactNode } from 'react';
import { Paper, Title, Text, Stack } from '@mantine/core';

type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/** v1's settings card: a bordered paper with a title, an optional dimmed description, then its fields. */
export function SettingsSection({ title, description, children }: Props) {
  return (
    <Paper p="lg" radius="md" withBorder>
      <Stack gap="md">
        <div>
          <Title order={3} size="h4" mb={4}>{title}</Title>
          {description && <Text size="sm" c="dimmed">{description}</Text>}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
