/**
 * The Ember look (mockup row "A · Ember"). These are THE values: the mockup boards in
 * agent-handoffs/next-ui-mockups/*.dc.html are the spec and these numbers come from them.
 * Use them through the CSS vars (`var(--il-bg)`) in styles, or import `T` in TS when a number
 * is needed (sizes, radii). Never invent a new colour: ask for one here.
 */
import { LIVE } from './live';

/** Corner radii and spacing follow Settings → Themes (Corners, Density) through LIVE. */
const r = (px: number) => Math.round(px * LIVE.corners);
const sp = (px: number) => Math.round(px * LIVE.density);

export const T = {
  /** Every colour is its CSS var (item 35: themes rewrite the vars on <html>); `var(--il-x, <Ember>)`. */
  color: {
    bg: 'var(--il-bg, #141416)',               // page
    bgDeep: 'var(--il-bg-deep, #0F0F11)',      // the sticky workflow block, darkest
    panel: 'var(--il-panel, #1A1A1E)',         // side panels
    elev: 'var(--il-elev, #1C1C21)',           // pills, inputs, cards
    card: 'var(--il-card, #222228)',           // raised cards / chips
    cardOn: 'var(--il-card-on, #2B2B33)',      // hovered / selected chip
    line: 'var(--il-line, #26262C)',           // hairlines between regions
    lineSoft: 'var(--il-line-soft, #2A2A31)',  // card borders
    lineStrong: 'var(--il-line-strong, #2F2F38)',
    fg: 'var(--il-fg, #F2F2F4)',
    fg2: 'var(--il-fg2, #C9C9D2)',
    muted: 'var(--il-muted, #9A9AA6)',
    dim: 'var(--il-dim, #5E5E6A)',
    ember: 'var(--il-ember, #F0863A)',         // the accent (named ember for history)
    emberHi: 'var(--il-ember-hi, #FFB36B)',
    emberSoft: 'var(--il-ember-soft, #2A2420)', // accent tint on a dark card
    emberLine: 'var(--il-ember-line, #5A4A3E)', // accent-tinted border
    accent2: 'var(--il-accent2, #F0BC3A)',      // gradients' second colour
    onAccent: 'var(--il-on-accent, #0F0F11)',   // text on the accent
    ok: 'var(--il-ok, #3DD68C)',
    okSoft: 'var(--il-ok-soft, #1F2A2A)',
    okLine: 'var(--il-ok-line, #3E5050)',
    warn: 'var(--il-warn, #C9B84F)',
    err: 'var(--il-err, #C96A6A)',
    info: 'var(--il-info, #6FA0CF)',
  },
  radius: {
    pill: 999,
    get xl() { return r(16); }, get lg() { return r(14); }, get md() { return r(12); },
    get sm() { return r(10); }, get xs() { return r(8); }, get field() { return r(10); },
  },
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
  gap: {
    get xs() { return sp(4); }, get sm() { return sp(6); }, get md() { return sp(8); },
    get lg() { return sp(10); }, get xl() { return sp(14); },
  },
  pad: { get panel() { return sp(10); }, get card() { return sp(10); } },
  font: 'var(--il-font, "Manrope Variable", Manrope, system-ui, sans-serif)',
  blur: 'var(--il-blur, blur(18px))',
  z: { rail: 70, dock: 80, sheet: 150, modal: 200, viewer: 250, popover: 300, confirm: 400 },
} as const;

export type Tokens = typeof T;

/**
 * Button rounding, ONE theme token (item 33): the CSS var `--il-btn-round` (styles/next.css,
 * default .85 = Donny's "15% less" than a full pill). A button `h` px high gets
 * radius = h/2 × that token. Themes (item 35) change the var, nothing else; every shared button
 * (Button, Pill, Chip, IconBtn, Tabs, Mantine Button) reads it through here or the var.
 */
export const BTN_ROUND_VAR = '--il-btn-round';
export const btnRadius = (h: number): string => `calc(${h / 2}px * var(${BTN_ROUND_VAR}, .85))`;
