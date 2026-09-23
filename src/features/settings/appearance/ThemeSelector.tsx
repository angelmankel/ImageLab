import { useMemo } from 'react';
import { SimpleGrid, SegmentedControl, Group, Stack } from '@mantine/core';
import { IconLayoutGrid, IconEye } from '@tabler/icons-react';
import { useThemeStore, themes } from '@/modules/theme';
import type { AnyThemeConfig, ThemeViewMode } from '@/modules/theme';
import { ThemeCard } from './ThemeCard';
import { ThemePreviewCard } from './ThemePreviewCard';
import { CreateCustomThemeCard } from './CustomThemeCreator';

/** v1's theme grid: built-in and custom themes, a swatch/mockup view toggle, and the create card. */
export function ThemeSelector() {
  const currentTheme = useThemeStore(s => s.currentTheme);
  const setTheme = useThemeStore(s => s.setTheme);
  const themeViewMode = useThemeStore(s => s.themeViewMode);
  const setThemeViewMode = useThemeStore(s => s.setThemeViewMode);
  const customThemes = useThemeStore(s => s.customThemes);
  const removeCustomTheme = useThemeStore(s => s.removeCustomTheme);

  const allThemes: AnyThemeConfig[] = useMemo(
    () => [...Object.values(themes), ...customThemes],
    [customThemes],
  );

  const CardComponent = themeViewMode === 'preview' ? ThemePreviewCard : ThemeCard;

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          value={themeViewMode}
          onChange={(v) => setThemeViewMode(v as ThemeViewMode)}
          aria-label="Theme card style"
          data={[
            { value: 'grid', label: <IconLayoutGrid size={14} aria-label="Swatches" /> },
            { value: 'preview', label: <IconEye size={14} aria-label="Preview" /> },
          ]}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {allThemes.map(theme => (
          <CardComponent
            key={theme.id}
            theme={theme}
            isSelected={currentTheme === theme.id}
            onSelect={() => setTheme(theme.id)}
            onDelete={theme.id.startsWith('custom-') ? () => removeCustomTheme(theme.id) : undefined}
          />
        ))}
        <CreateCustomThemeCard />
      </SimpleGrid>
    </Stack>
  );
}
