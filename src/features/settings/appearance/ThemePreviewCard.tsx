import { UnstyledButton, Stack, Box } from '@mantine/core';
import { createDarkPalette } from '@/modules/theme';
import { ThemeCardFooter, type ThemeCardProps } from './ThemeCard';
import classes from './ThemePreviewCard.module.css';

/** v1's mini app mockup card, for comparing themes as they would actually look. */
export function ThemePreviewCard({ theme, isSelected, onSelect, onDelete }: ThemeCardProps) {
  const primary = theme.primaryColor[6];
  const dark = createDarkPalette(primary);

  return (
    <UnstyledButton onClick={onSelect} className={classes.previewCard} data-selected={isSelected} aria-pressed={isSelected}>
      <Stack gap="xs">
        <Box className={classes.mockup} style={{ backgroundColor: dark[8] }}>
          <Box className={classes.mockupHeader} style={{ backgroundColor: dark[7] }}>
            <Box className={classes.mockupHeaderDot} style={{ backgroundColor: '#ff5f57' }} />
            <Box className={classes.mockupHeaderDot} style={{ backgroundColor: '#ffbd2e' }} />
            <Box className={classes.mockupHeaderDot} style={{ backgroundColor: '#28c840' }} />
          </Box>
          <Box className={classes.mockupBody}>
            <Box className={classes.mockupSidebar} style={{ backgroundColor: dark[6] }}>
              <Box className={classes.mockupSidebarDot} style={{ backgroundColor: primary }} />
              <Box className={classes.mockupSidebarDot} style={{ backgroundColor: dark[3] }} />
              <Box className={classes.mockupSidebarDot} style={{ backgroundColor: dark[3] }} />
            </Box>
            <Box className={classes.mockupContent}>
              <Box className={classes.mockupCard} style={{ backgroundColor: dark[5] }} />
              <Box className={classes.mockupCard} style={{ backgroundColor: dark[5] }} />
              <Box className={classes.mockupButton} style={{ backgroundColor: primary }} />
            </Box>
          </Box>
          <Box className={classes.mockupFooter} style={{ backgroundColor: dark[7] }} />
        </Box>
        <ThemeCardFooter theme={theme} isSelected={isSelected} onDelete={onDelete} />
      </Stack>
    </UnstyledButton>
  );
}
