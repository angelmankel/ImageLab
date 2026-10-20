import { createTheme, mergeThemeOverrides, type MantineColorsTuple, type MantineThemeOverride } from '@mantine/core';
import { T } from './tokens';
import { viewerLayerRef } from './scrollShards';

/**
 * Mantine wears the Ember palette. The `dark` scale is laid out so the MAIN app's Tailwind tokens
 * (src/styles/index.css: bg-base = dark-8, bg-panel = dark-7, bg-elev = dark-6, border-subtle =
 * dark-5, border-default = dark-4, fg-secondary = dark-0, fg-muted = dark-2) land on the right
 * Ember colour — so the reused FullscreenImage viewer and friends match the new UI.
 */
const dark: MantineColorsTuple = [
  T.color.fg2,        // 0  fg-secondary
  T.color.muted,      // 1  fg-tertiary
  T.color.muted,      // 2  fg-muted
  T.color.dim,        // 3  fg-dim / scrollbar thumb
  T.color.lineStrong, // 4  border-default
  T.color.lineSoft,   // 5  border-subtle / card-on
  T.color.elev,       // 6  bg-elev / input / card
  T.color.panel,      // 7  bg-panel
  T.color.bg,         // 8  bg-base
  T.color.bgDeep,     // 9
];

/** The accent's ten shades are CSS vars (styles/theme.css derives them from --il-ember / --il-ember-hi),
 *  so a theme's accent recolours every Mantine part too (item 35). */
const ember = Array.from({ length: 10 }, (_, i) => `var(--il-acc-${i})`) as unknown as MantineColorsTuple;
const rad = (px: number) => `calc(${px}px * var(--il-corners, 1))`;

export const emberTheme = createTheme({
  fontFamily: T.font,
  headings: { fontFamily: T.font, fontWeight: '800' },
  primaryColor: 'ember',
  primaryShade: 5,
  colors: { dark, ember },
  defaultRadius: 'md',
  radius: { xs: rad(8), sm: rad(10), md: rad(12), lg: rad(14), xl: rad(16) },
  fontSizes: { xs: '11px', sm: '12px', md: '13px', lg: '14px', xl: '16px' },
  components: {
    // Item 26: every tooltip near-instant with a quick fade, in the dark `.il-tip` card.
    Tooltip: {
      defaultProps: { withArrow: false, openDelay: 60, closeDelay: 0, transitionProps: { transition: 'fade', duration: 90 } },
      classNames: { tooltip: 'il-tip' },
    },
    // Item 33: Mantine buttons share the one rounding token (half the height × --il-btn-round)
    // and the .il-btn hover / press feedback (item 44).
    Button: {
      classNames: { root: 'il-btn' },
      vars: () => ({ root: { '--button-radius': 'calc(var(--button-height) / 2 * var(--il-btn-round, .85))' } }),
    },
    // Item 38: every Mantine pick list wears the SearchSelect look (.il-dd / .il-opt in next.css),
    // opens with a soft pop, and never spell-checks or offers autofill on its search box.
    Select: {
      classNames: { dropdown: 'il-dd', option: 'il-opt', groupLabel: 'il-glabel', empty: 'il-empty' },
      defaultProps: { spellCheck: false, autoComplete: 'off', 'data-1p-ignore': true, comboboxProps: { transitionProps: { transition: 'pop', duration: 120 } } },
    },
    Autocomplete: {
      classNames: { dropdown: 'il-dd', option: 'il-opt', groupLabel: 'il-glabel', empty: 'il-empty' },
      defaultProps: { spellCheck: false, autoComplete: 'off', 'data-1p-ignore': true, comboboxProps: { transitionProps: { transition: 'pop', duration: 120 } } },
    },
    MultiSelect: {
      classNames: { dropdown: 'il-dd', option: 'il-opt', groupLabel: 'il-glabel', empty: 'il-empty' },
      defaultProps: { spellCheck: false, comboboxProps: { transitionProps: { transition: 'pop', duration: 120 } } },
    },
    // Every Mantine text box: the ember focus ring of the .il-field shape.
    Input: { classNames: { input: 'il-minput' } },
    Menu: { classNames: { dropdown: 'il-dd' }, defaultProps: { transitionProps: { transition: 'pop', duration: 120 } } },
    // The model viewer sits above these, outside their DOM: let it scroll (see scrollShards.ts).
    Modal: { defaultProps: { removeScrollProps: { shards: [viewerLayerRef] } } },
    Drawer: { defaultProps: { removeScrollProps: { shards: [viewerLayerRef] } } },
  },
});

/** Mantine's own transition lengths (ms) at speed 1. */
const DURATIONS = { Tooltip: 90, Popover: 150, Menu: 150, Combobox: 150, Modal: 200, Drawer: 200 } as const;

/**
 * The Ember theme with Mantine's transitions scaled by the Themes motion setting (item 35):
 * `factor` = speed × (motion on ? 1 : 0); 0 = every Mantine transition instant.
 */
export function themeWithMotion(factor: number): MantineThemeOverride {
  if (factor === 1) return emberTheme;
  const components: Record<string, { defaultProps: { transitionProps: { duration: number } } }> = {};
  for (const [name, ms] of Object.entries(DURATIONS)) {
    components[name] = { defaultProps: { transitionProps: { duration: Math.round(ms * factor) } } };
  }
  return mergeThemeOverrides(emberTheme, { components });
}
