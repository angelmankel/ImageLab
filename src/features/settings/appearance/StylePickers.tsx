import { SegmentedControl, Text, Stack } from '@mantine/core';
import {
  useThemeStore,
  GRADIENT_STYLE_OPTIONS, BORDER_RADIUS_OPTIONS, SHADOW_INTENSITY_OPTIONS, UI_BORDER_STYLE_OPTIONS,
} from '@/modules/theme';
import type { GradientStyle, BorderRadiusStyle, ShadowIntensity, UIBorderStyle } from '@/modules/theme';
import { useStore } from '@/lib/store';
import { ICON_STYLES, resolveTheme, type IconStyle } from '@/lib/themes';

type Option<T extends string> = { value: T; label: string; description: string };

/** v1's option picker: a full-width segmented control with the chosen option's description under it. */
function OptionPicker<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const current = options.find(o => o.value === value);
  return (
    <Stack gap="xs">
      <SegmentedControl
        value={value}
        onChange={(v) => onChange(v as T)}
        data={options.map(o => ({ value: o.value, label: o.label }))}
        fullWidth
        aria-label={ariaLabel}
      />
      {current && <Text size="xs" c="dimmed">{current.description}</Text>}
    </Stack>
  );
}

export function GradientStylePicker() {
  const value = useThemeStore(s => s.gradientStyle);
  const set = useThemeStore(s => s.setGradientStyle);
  return <OptionPicker<GradientStyle> value={value} options={GRADIENT_STYLE_OPTIONS} onChange={set} ariaLabel="Background style" />;
}

export function BorderRadiusPicker() {
  const value = useThemeStore(s => s.borderRadiusStyle);
  const set = useThemeStore(s => s.setBorderRadiusStyle);
  return <OptionPicker<BorderRadiusStyle> value={value} options={BORDER_RADIUS_OPTIONS} onChange={set} ariaLabel="Border radius" />;
}

export function ShadowStylePicker() {
  const value = useThemeStore(s => s.shadowIntensity);
  const set = useThemeStore(s => s.setShadowIntensity);
  return <OptionPicker<ShadowIntensity> value={value} options={SHADOW_INTENSITY_OPTIONS} onChange={set} ariaLabel="Shadows" />;
}

export function BorderStylePicker() {
  const value = useThemeStore(s => s.uiBorderStyle);
  const set = useThemeStore(s => s.setUIBorderStyle);
  return <OptionPicker<UIBorderStyle> value={value} options={UI_BORDER_STYLE_OPTIONS} onChange={set} ariaLabel="Borders" />;
}

/**
 * Icon weight still lives on the older theme record in the main store (`components/ui/icons.tsx`
 * reads it from there). A built-in record can't be edited, so the first change forks it into a
 * custom one; later changes edit that fork in place.
 */
export function IconStylePicker() {
  const active = useStore(s => resolveTheme(s.themeId, s.customThemes));
  const createCustomTheme = useStore(s => s.createCustomTheme);
  const updateCustomTheme = useStore(s => s.updateCustomTheme);
  const options = ICON_STYLES.map(s => ({ value: s.value, label: s.label, description: s.hint }));

  const set = (iconStyle: IconStyle) => {
    if (iconStyle === active.iconStyle) return;
    const id = active.builtIn ? createCustomTheme(active.id, `${active.name} (custom)`) : active.id;
    updateCustomTheme(id, { iconStyle });
  };

  return <OptionPicker<IconStyle> value={active.iconStyle} options={options} onChange={set} ariaLabel="Icon style" />;
}
