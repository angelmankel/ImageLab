import type { MouseEvent } from 'react';
import { UnstyledButton, Group, Text, Stack, Box } from '@mantine/core';
import { IconCheck, IconTrash } from '@tabler/icons-react';
import type { AnyThemeConfig } from '@/modules/theme';
import classes from './ThemeCard.module.css';

export type ThemeCardProps = {
  theme: AnyThemeConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
};

/** v1's compact theme card: four swatches from the palette, the name, delete and check marks. */
export function ThemeCard({ theme, isSelected, onSelect, onDelete }: ThemeCardProps) {
  return (
    <UnstyledButton onClick={onSelect} className={classes.themeCard} data-selected={isSelected} aria-pressed={isSelected}>
      <Stack gap="xs">
        <Group gap="xs" justify="center">
          {theme.primaryColor.slice(4, 8).map((color, i) => (
            <Box
              key={i}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: color,
                border: '2px solid var(--mantine-color-dark-4)',
              }}
            />
          ))}
        </Group>
        <ThemeCardFooter theme={theme} isSelected={isSelected} onDelete={onDelete} />
      </Stack>
    </UnstyledButton>
  );
}

/** Name row shared by both card styles. The delete mark is a span so it can sit inside the card's button. */
export function ThemeCardFooter({ theme, isSelected, onDelete }: Pick<ThemeCardProps, 'theme' | 'isSelected' | 'onDelete'>) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Text size="sm" fw={500} truncate>{theme.name}</Text>
      <Group gap={4} wrap="nowrap">
        {onDelete && (
          <Box
            component="span"
            role="button"
            aria-label={`Delete ${theme.name}`}
            title="Delete custom theme"
            onClick={(e: MouseEvent) => { e.stopPropagation(); onDelete(); }}
            style={{ cursor: 'pointer', display: 'flex', opacity: 0.5 }}
          >
            <IconTrash size={14} />
          </Box>
        )}
        {isSelected && <IconCheck size={16} style={{ color: 'var(--mantine-primary-color-filled)' }} />}
      </Group>
    </Group>
  );
}
