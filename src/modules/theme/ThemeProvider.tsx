import { useMemo, useEffect, type ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { useThemeStore } from '@/stores/theme-store';
import { getTheme } from './themes';
import { createMantineTheme } from './mantine-theme';

/** Inter everywhere — the one departure from v1, which let each person pick a font. */
const APP_FONT = '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface ThemeProviderProps {
  children: ReactNode;
}

/** v1's theme provider: builds the Mantine theme from the stored look (colour, radius, shadows, borders). */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const fontWeight = useThemeStore((state) => state.fontWeight);
  const gradientStyle = useThemeStore((state) => state.gradientStyle);
  const borderRadiusStyle = useThemeStore((state) => state.borderRadiusStyle);
  const shadowIntensity = useThemeStore((state) => state.shadowIntensity);
  const uiBorderStyle = useThemeStore((state) => state.uiBorderStyle);
  const customThemes = useThemeStore((state) => state.customThemes);

  const theme = useMemo(() => {
    const themeConfig = getTheme(currentTheme, customThemes);
    const mantineThemeConfig = createMantineTheme(
      themeConfig, APP_FONT, gradientStyle,
      borderRadiusStyle, shadowIntensity, uiBorderStyle,
    );
    return createTheme(mantineThemeConfig);
  }, [currentTheme, gradientStyle, borderRadiusStyle, shadowIntensity, uiBorderStyle, customThemes]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-weight', String(fontWeight));
    document.body.style.fontWeight = String(fontWeight);
  }, [fontWeight]);

  return (
    <MantineProvider defaultColorScheme="dark" forceColorScheme="dark" theme={theme}>
      {children}
    </MantineProvider>
  );
}
