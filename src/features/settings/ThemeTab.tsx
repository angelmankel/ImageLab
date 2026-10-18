import { Stack } from '@mantine/core';
import { SettingsSection } from './SettingsSection';
import { ThemeSelector } from './appearance/ThemeSelector';
import {
  SurfaceStylePicker, GradientStylePicker, BorderRadiusPicker, ShadowStylePicker, BorderStylePicker, IconStylePicker,
} from './appearance/StylePickers';

/**
 * Appearance — v1's theme settings, all on the Mantine theme store. v1's font and font-weight
 * pickers are left out: the app is always Inter.
 */
export function ThemeTab() {
  return (
    <Stack gap="lg">
      <SettingsSection
        title="Theme"
        description="Customize the appearance of ImageLab Studio with different color themes"
      >
        <ThemeSelector />
      </SettingsSection>
      <SettingsSection title="Darkness" description="OLED black or the original dark gray, under any color theme">
        <SurfaceStylePicker />
      </SettingsSection>
      <SettingsSection title="Background" description="Choose a background gradient style for the main content area (Dark Gray only)">
        <GradientStylePicker />
      </SettingsSection>
      <SettingsSection title="Border Radius" description="Control the roundness of corners throughout the interface">
        <BorderRadiusPicker />
      </SettingsSection>
      <SettingsSection title="Shadows" description="Adjust shadow depth for cards, panels, and other elevated elements">
        <ShadowStylePicker />
      </SettingsSection>
      <SettingsSection title="Borders" description="Control the visibility and weight of borders between UI sections">
        <BorderStylePicker />
      </SettingsSection>
      <SettingsSection title="Icon Style" description="Stroke weight of the icons across the interface">
        <IconStylePicker />
      </SettingsSection>
    </Stack>
  );
}
