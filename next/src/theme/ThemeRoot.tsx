/**
 * Item 35: the theme at the root. `ThemedMantine` = MantineProvider wearing Ember with Mantine's
 * transitions scaled by the Themes motion setting (Off = instant). `ThemeRoot` re-renders the app
 * when Corners or Density change, so every `T.radius` / `T.gap` read picks up the new value live.
 * Importing this module applies the saved theme before the first render (themeStore).
 */
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { themeWithMotion } from './mantineTheme';
import { MOTION_FACTOR, SPEED_FACTOR } from './themeModel';
import { useTheme } from './themeStore';

export function ThemedMantine({ children }: { children: ReactNode }) {
  const motion = useTheme((s) => s.theme.motion);
  const speed = useTheme((s) => s.theme.speed);
  const factor = MOTION_FACTOR[motion] === 0 ? 0 : SPEED_FACTOR[speed];
  const theme = useMemo(() => themeWithMotion(factor), [factor]);
  return <MantineProvider defaultColorScheme="dark" forceColorScheme="dark" theme={theme}>{children}</MantineProvider>;
}

export function ThemeRoot({ app: App }: { app: ComponentType }) {
  useTheme((s) => s.layoutRev);
  return <App />;
}
