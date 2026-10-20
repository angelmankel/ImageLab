/**
 * The Ember look (mockup row "A · Ember"). These are THE values: the mockup boards in
 * agent-handoffs/next-ui-mockups/*.dc.html are the spec and these numbers come from them.
 * Use them through the CSS vars (`var(--il-bg)`) in styles, or import `T` in TS when a number
 * is needed (sizes, radii). Never invent a new colour: ask for one here.
 */
export const T = {
  color: {
    bg: '#141416',        // page
    bgDeep: '#0F0F11',    // the sticky workflow block, darkest
    panel: '#1A1A1E',     // side panels
    elev: '#1C1C21',      // pills, inputs, cards
    card: '#222228',      // raised cards / chips
    cardOn: '#2B2B33',    // hovered / selected chip
    line: '#26262C',      // hairlines between regions
    lineSoft: '#2A2A31',  // card borders
    lineStrong: '#2F2F38',
    fg: '#F2F2F4',
    fg2: '#C9C9D2',
    muted: '#9A9AA6',
    dim: '#5E5E6A',
    ember: '#F0863A',
    emberHi: '#FFB36B',
    emberSoft: '#2A2420', // ember tint on a dark card
    emberLine: '#5A4A3E', // ember-tinted border
    ok: '#3DD68C',
    okSoft: '#1F2A2A',
    okLine: '#3E5050',
    warn: '#C9B84F',
    err: '#C96A6A',
    info: '#6FA0CF',
  },
  radius: { pill: 999, xl: 16, lg: 14, md: 12, sm: 10, xs: 8 },
  size: {
    topBar: 56,
    rail: 84,
    toolbar: 52,
    stepPanel: 404,
    stepPanelMin: 320,
    historyPanel: 470,  // fits This step | All + the four filters on one row (Donny, 10-20)
    libraryPanel: 380,
    modelsPanel: 380,
    collapsedTab: 22,
    dockRow: 56,
  },
  gap: { xs: 4, sm: 6, md: 8, lg: 10, xl: 14 },
  pad: { panel: 10, card: 10 },
  font: 'Manrope Variable, Manrope, system-ui, sans-serif',
  blur: 'blur(18px)',
  z: { rail: 70, dock: 80, sheet: 150, modal: 200, viewer: 250, popover: 300, confirm: 400 },
} as const;

export type Tokens = typeof T;
