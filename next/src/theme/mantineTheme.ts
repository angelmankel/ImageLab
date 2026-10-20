import { createTheme, type MantineColorsTuple } from '@mantine/core';
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

const ember: MantineColorsTuple = [
  '#FFF1E6', '#FFDFC2', '#FFC996', '#FFB36B', '#F89A4C', '#F0863A', '#D9702A', '#B85A1F', '#8F4417', '#5A2A0D',
];

export const emberTheme = createTheme({
  fontFamily: T.font,
  headings: { fontFamily: T.font, fontWeight: '800' },
  primaryColor: 'ember',
  primaryShade: 5,
  colors: { dark, ember },
  defaultRadius: 'md',
  radius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
  fontSizes: { xs: '11px', sm: '12px', md: '13px', lg: '14px', xl: '16px' },
  components: {
    Tooltip: { defaultProps: { withArrow: false, openDelay: 400 } },
    // The model viewer sits above these, outside their DOM: let it scroll (see scrollShards.ts).
    Modal: { defaultProps: { removeScrollProps: { shards: [viewerLayerRef] } } },
    Drawer: { defaultProps: { removeScrollProps: { shards: [viewerLayerRef] } } },
  },
});
