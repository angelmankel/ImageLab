import { useMemo, useState } from 'react';
import { UnstyledButton, Modal, ColorPicker, TextInput, Button, Group, Stack, Text, Box } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useThemeStore, generateColorPalette, createDarkPalette } from '@/modules/theme';
import type { CustomThemeConfig, CustomThemeId } from '@/modules/theme';
import classes from './ThemeCard.module.css';

const shortId = () => Math.random().toString(36).slice(2, 10);

/** Dashed "Create Custom" card that opens v1's custom theme creator. */
export function CreateCustomThemeCard() {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <UnstyledButton
        onClick={open}
        className={classes.themeCard}
        style={{
          border: '2px dashed var(--mantine-color-dark-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 88,
        }}
      >
        <Stack gap={4} align="center">
          <IconPlus size={24} style={{ opacity: 0.5 }} />
          <Text size="sm" c="dimmed">Create Custom</Text>
        </Stack>
      </UnstyledButton>
      {/* Stacked over the settings modal, so it sits one layer higher. */}
      <Modal opened={opened} onClose={close} title="Create Custom Theme" size="md" centered zIndex={250}
        styles={{ body: { paddingTop: 'var(--mantine-spacing-md)' } }}>
        <CustomThemeCreatorContent onClose={close} />
      </Modal>
    </>
  );
}

function CustomThemeCreatorContent({ onClose }: { onClose: () => void }) {
  const [color, setColor] = useState('#6366F1');
  const [name, setName] = useState('');
  const addCustomTheme = useThemeStore(s => s.addCustomTheme);
  const setTheme = useThemeStore(s => s.setTheme);

  const palette = useMemo(() => generateColorPalette(color), [color]);
  const dark = useMemo(() => createDarkPalette(color), [color]);

  const handleCreate = () => {
    const id = `custom-${shortId()}` as CustomThemeId;
    const theme: CustomThemeConfig = {
      id,
      name: name.trim() || 'Custom Theme',
      primaryColorName: `custom_${shortId()}`,
      primaryColor: palette,
      baseColor: color,
    };
    addCustomTheme(theme);
    setTheme(id);
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Theme Name"
        placeholder="My Custom Theme"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        data-autofocus
      />
      <div>
        <Text size="sm" fw={500} mb="xs">Base Color</Text>
        <ColorPicker value={color} onChange={setColor} fullWidth format="hex" />
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">Preview</Text>
        <Box
          style={{
            height: 100,
            borderRadius: 'var(--mantine-radius-sm)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: dark[8],
          }}
        >
          <Box style={{ height: 12, backgroundColor: dark[7], flexShrink: 0 }} />
          <Box style={{ flex: 1, display: 'flex' }}>
            <Box style={{ width: 20, backgroundColor: dark[6] }} />
            <Box style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box style={{ height: 18, backgroundColor: dark[5], borderRadius: 2, opacity: 0.6 }} />
              <Box style={{ height: 18, backgroundColor: dark[5], borderRadius: 2, opacity: 0.6 }} />
              <Box style={{ width: 36, height: 10, backgroundColor: color, borderRadius: 2, marginTop: 'auto' }} />
            </Box>
          </Box>
          <Box style={{ height: 8, backgroundColor: dark[7], flexShrink: 0 }} />
        </Box>
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">Palette</Text>
        <Group gap={4}>
          {palette.map((c, i) => (
            <Box
              key={i}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: c,
                border: '2px solid var(--mantine-color-dark-4)',
              }}
            />
          ))}
        </Group>
      </div>

      <Group justify="flex-end" mt="xs">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate}>Create Theme</Button>
      </Group>
    </Stack>
  );
}
