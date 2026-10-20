/**
 * Item 35, the pure part of Settings → Themes (node tests in tests/themeModel.test.cjs; no imports):
 *   - colour maths (hex ⇄ OKLCH, mixing, gamut clamp, contrast pick);
 *   - the palette = every colour token the next/ app reads as a CSS var (`--il-<kebab key>`);
 *   - the generator: ONE seed colour (+ tint, darkness, contrast, 2nd-colour harmony) → a full palette;
 *   - the built-in palettes (Ember is the exact original look; the rest are generated);
 *   - OLED: any palette → pure-black backgrounds, derived from its own tokens;
 *   - the theme settings (palette + type + size + shape + depth + motion), their defaults, a
 *     sanitizer for stored / imported JSON, and `themeVars` = the CSS vars + <html> data-attributes
 *     that apply one (theme/applyTheme.ts writes them).
 */

// ---- colour maths ---------------------------------------------------------------------------

export interface Rgb { r: number; g: number; b: number } // 0..1, gamma-encoded sRGB
export interface Oklch { l: number; c: number; h: number }

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s.trim());

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Linear-light sRGB, unclamped (may leave 0..1 for out-of-gamut colours). */
function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, Bb);
  let h = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

const inGamut = (x: Rgb) => [x.r, x.g, x.b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → hex; chroma is lowered (hue and lightness kept) until the colour fits sRGB. */
export function oklchToHex({ l, c, h }: Oklch): string {
  const L = Math.min(1, Math.max(0, l));
  const rad = (h * Math.PI) / 180;
  const at = (cc: number) => oklabToLinear(L, cc * Math.cos(rad), cc * Math.sin(rad));
  let lin = at(c);
  if (!inGamut(lin)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(at(mid))) lo = mid; else hi = mid; }
    lin = at(lo);
  }
  return rgbToHex({ r: toGam(lin.r), g: toGam(lin.g), b: toGam(lin.b) });
}

/** `t` of the way from a to b, in sRGB (what CSS color-mix in srgb does). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** WCAG relative luminance, 0..1. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ---- the palette ----------------------------------------------------------------------------

/** Every colour token. Keys match `T.color` (tokens.ts); the CSS var is `--il-` + kebab(key). */
export interface Palette {
  bg: string; bgDeep: string; panel: string; elev: string; card: string; cardOn: string;
  line: string; lineSoft: string; lineStrong: string;
  fg: string; fg2: string; muted: string; dim: string;
  ember: string; emberHi: string; emberSoft: string; emberLine: string; accent2: string;
  ok: string; okSoft: string; okLine: string; warn: string; err: string; info: string;
}
export type PaletteKey = keyof Palette;

export const PALETTE_KEYS: readonly PaletteKey[] = [
  'bgDeep', 'bg', 'panel', 'elev', 'card', 'cardOn', 'line', 'lineSoft', 'lineStrong',
  'dim', 'muted', 'fg2', 'fg', 'emberSoft', 'emberLine', 'ember', 'emberHi', 'accent2',
  'ok', 'okSoft', 'okLine', 'warn', 'err', 'info',
];

/** Names the fine-tune list shows. */
export const PALETTE_LABELS: Record<PaletteKey, string> = {
  bgDeep: 'Deepest', bg: 'Page', panel: 'Panels', elev: 'Inputs & pills', card: 'Cards', cardOn: 'Hover / selected',
  line: 'Hairlines', lineSoft: 'Card borders', lineStrong: 'Strong borders',
  dim: 'Dim text', muted: 'Muted text', fg2: 'Secondary text', fg: 'Text',
  emberSoft: 'Accent tint', emberLine: 'Accent border', ember: 'Accent', emberHi: 'Accent bright', accent2: 'Second colour',
  ok: 'Success', okSoft: 'Success tint', okLine: 'Success border', warn: 'Warning', err: 'Error', info: 'Info',
};

export const cssVarOf = (k: PaletteKey) => `--il-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** The original Ember look (mockup row A), exact. */
export const EMBER: Palette = {
  bg: '#141416', bgDeep: '#0F0F11', panel: '#1A1A1E', elev: '#1C1C21', card: '#222228', cardOn: '#2B2B33',
  line: '#26262C', lineSoft: '#2A2A31', lineStrong: '#2F2F38',
  fg: '#F2F2F4', fg2: '#C9C9D2', muted: '#9A9AA6', dim: '#5E5E6A',
  ember: '#F0863A', emberHi: '#FFB36B', emberSoft: '#2A2420', emberLine: '#5A4A3E', accent2: '#F0BC3A',
  ok: '#3DD68C', okSoft: '#1F2A2A', okLine: '#3E5050', warn: '#C9B84F', err: '#C96A6A', info: '#6FA0CF',
};

// ---- the generator --------------------------------------------------------------------------

export type Depth = 'deep' | 'dark' | 'dim';
export type Contrast = 'soft' | 'normal' | 'high';
export type Harmony = 'near' | 'opposite' | 'triad' | 'custom';

export interface GenParams {
  seed: string;        // the accent, hex
  tint: number;        // 0 = neutral greys … 1 = greys strongly tinted toward the accent's hue
  depth: Depth;
  contrast: Contrast;
  harmony: Harmony;    // where the second colour (gradients) comes from
  second?: string;     // the second colour when harmony = custom
}

export const DEFAULT_GEN: GenParams = { seed: '#F0863A', tint: 0, depth: 'dark', contrast: 'normal', harmony: 'near' };

type NeutralKey = 'bgDeep' | 'bg' | 'panel' | 'elev' | 'card' | 'cardOn' | 'line' | 'lineSoft' | 'lineStrong';
type TextKey = 'fg' | 'fg2' | 'muted' | 'dim';
/** OKLCH lightness of each neutral at "dark" (= Ember's, measured); deep / dim shift the whole ladder. */
const LADDER: Record<NeutralKey, number> = {
  bgDeep: 0.169, bg: 0.192, panel: 0.22, elev: 0.229, card: 0.255, cardOn: 0.292, line: 0.271, lineSoft: 0.288, lineStrong: 0.309,
};
const DEPTH_SHIFT: Record<Depth, number> = { deep: -0.035, dark: 0, dim: 0.06 };
const TEXT: Record<Contrast, Record<TextKey, number>> = {
  soft: { fg: 0.9, fg2: 0.78, muted: 0.63, dim: 0.46 },
  normal: { fg: 0.962, fg2: 0.839, muted: 0.69, dim: 0.486 },
  high: { fg: 0.995, fg2: 0.91, muted: 0.78, dim: 0.58 },
};
/** Ember's own grey chroma (a whisper of blue-violet), per token, and how much tint adds on top. */
const GREY_C: Record<NeutralKey | TextKey, [number, number]> = {
  bgDeep: [0.004, 0.02], bg: [0.004, 0.022], panel: [0.008, 0.024], elev: [0.0096, 0.025], card: [0.011, 0.028], cardOn: [0.014, 0.03],
  line: [0.011, 0.024], lineSoft: [0.0127, 0.026], lineStrong: [0.016, 0.028],
  dim: [0.019, 0.022], muted: [0.017, 0.018], fg2: [0.012, 0.012], fg: [0.003, 0.006],
};
const HARMONY_SHIFT: Record<Exclude<Harmony, 'custom'>, number> = { near: 38, opposite: 180, triad: 120 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (h: number) => ((h % 360) + 360) % 360;

/** The accent as used: bright enough that the app's dark text on it stays readable. */
export function usableAccent(seed: string): Oklch {
  const s = hexToOklch(isHex(seed) ? seed : DEFAULT_GEN.seed);
  return { l: clamp(s.l, 0.68, 0.9), c: s.c, h: s.h };
}

export function secondColour(p: GenParams): string {
  if (p.harmony === 'custom' && isHex(p.second)) return oklchToHex(usableAccent(p.second));
  const a = usableAccent(p.seed);
  const shift = HARMONY_SHIFT[p.harmony === 'custom' ? 'near' : p.harmony];
  return oklchToHex({ l: clamp(a.l + 0.06, 0.7, 0.9), c: Math.max(a.c, 0.06), h: wrap(a.h + shift) });
}

/** One seed colour → every token. */
export function generatePalette(p: GenParams): Palette {
  const a = usableAccent(p.seed);
  const t = clamp(Number(p.tint) || 0, 0, 1);
  const shift = DEPTH_SHIFT[p.depth] ?? 0;
  const X = TEXT[p.contrast] ?? TEXT.normal;
  const lineBoost = p.contrast === 'high' ? 0.03 : p.contrast === 'soft' ? -0.012 : 0;
  // Greys: Ember's blue-violet whisper at tint 0, the accent's hue as the tint grows.
  const hue = t < 0.02 ? 286 : a.h;
  const grey = (k: NeutralKey | TextKey, l: number) => oklchToHex({ l, c: GREY_C[k][0] + t * GREY_C[k][1], h: hue });
  const n = (k: NeutralKey) => grey(k, LADDER[k] + shift + (k.startsWith('line') ? lineBoost : 0));
  const card = LADDER.card + shift;
  const okH = 165;
  return {
    bgDeep: n('bgDeep'), bg: n('bg'), panel: n('panel'), elev: n('elev'), card: n('card'), cardOn: n('cardOn'),
    line: n('line'), lineSoft: n('lineSoft'), lineStrong: n('lineStrong'),
    fg: grey('fg', X.fg), fg2: grey('fg2', X.fg2), muted: grey('muted', X.muted), dim: grey('dim', X.dim),
    ember: oklchToHex(a),
    emberHi: oklchToHex({ l: clamp(a.l + 0.1, 0.8, 0.95), c: a.c * 0.82, h: a.h + 6 }),
    // Ember's tint and border are quiet: a little of the accent's hue on a card-dark grey.
    emberSoft: oklchToHex({ l: card + 0.011, c: Math.min(0.02, a.c * 0.075), h: a.h }),
    emberLine: oklchToHex({ l: card + 0.167, c: Math.min(0.04, a.c * 0.19), h: a.h }),
    accent2: secondColour(p),
    ok: '#3DD68C', okSoft: oklchToHex({ l: card + 0.02, c: 0.015, h: okH }), okLine: oklchToHex({ l: card + 0.16, c: 0.024, h: okH }),
    warn: '#C9B84F', err: '#C96A6A', info: '#6FA0CF',
  };
}

/** A random, pleasant generator input (the dice button). `rnd` is injectable for tests. */
export function shuffleGen(base: GenParams, rnd: () => number = Math.random): GenParams {
  const h = rnd() * 360;
  const seed = oklchToHex({ l: 0.72 + rnd() * 0.1, c: 0.1 + rnd() * 0.08, h });
  const harmonies: Harmony[] = ['near', 'opposite', 'triad'];
  return { ...base, seed, tint: Math.round((0.1 + rnd() * 0.45) * 100) / 100, harmony: harmonies[Math.floor(rnd() * 3)] };
}

/** Twelve quick seeds around the wheel + white. */
export const QUICK_SEEDS: readonly string[] = [
  '#F06A6A', '#F0863A', '#E8C14A', '#9BD14A', '#4CC38A', '#3CCFCF', '#4FA3F7', '#7C83F7', '#A98BFF', '#E07AF0', '#F06A8A', '#E6E6E6',
];

// ---- built-in palettes ----------------------------------------------------------------------

export interface NamedPalette { id: string; name: string; palette: Palette; gen?: GenParams }

const preset = (id: string, name: string, gen: Partial<GenParams>): NamedPalette => {
  const g = { ...DEFAULT_GEN, ...gen };
  return { id, name, palette: generatePalette(g), gen: g };
};

export const PRESETS: readonly NamedPalette[] = [
  { id: 'ember', name: 'Ember', palette: EMBER, gen: DEFAULT_GEN },
  preset('ocean', 'Ocean', { seed: '#4FA3F7', tint: 0.35, harmony: 'near' }),
  preset('moss', 'Moss', { seed: '#4CC38A', tint: 0.3, harmony: 'near' }),
  preset('violet', 'Violet', { seed: '#A98BFF', tint: 0.4, harmony: 'near' }),
  preset('rose', 'Rose', { seed: '#F06A8A', tint: 0.3, harmony: 'near' }),
  preset('teal', 'Teal', { seed: '#3CCFCF', tint: 0.35, harmony: 'triad' }),
  preset('brass', 'Brass', { seed: '#E8C14A', tint: 0.25, harmony: 'near' }),
  preset('graphite', 'Graphite', { seed: '#E6E6E6', tint: 0, contrast: 'high', harmony: 'near' }),
  preset('crimson', 'Crimson', { seed: '#F25C5C', tint: 0.3, depth: 'deep', harmony: 'opposite' }),
  preset('dusk', 'Dusk', { seed: '#7C9CF7', tint: 0.3, depth: 'dim', harmony: 'opposite' }),
];

// ---- OLED -----------------------------------------------------------------------------------

/**
 * Pure-black backgrounds for ANY palette, from its own tokens: page, deepest and panels go to
 * #000; inputs / cards / hover keep their steps but sink toward black, so regions still read;
 * lines, text and accents stay.
 */
export function oledify(p: Palette): Palette {
  const k = '#000000';
  return {
    ...p,
    bgDeep: k, bg: k, panel: k,
    elev: mix(p.elev, k, 0.55), card: mix(p.card, k, 0.45), cardOn: mix(p.cardOn, k, 0.3),
    emberSoft: mix(p.emberSoft, k, 0.4), okSoft: mix(p.okSoft, k, 0.4),
  };
}

// ---- the theme ------------------------------------------------------------------------------

export type FontId = 'manrope' | 'inter' | 'system';
export type PromptFont = 'ui' | 'mono';
export type Density = 'compact' | 'cozy' | 'roomy';
export type Shadows = 'none' | 'soft' | 'deep';
export type Motion = 'full' | 'subtle' | 'off';
export type Speed = 'slow' | 'normal' | 'fast';
export type BgStyle = 'none' | 'glow' | 'aurora' | 'fade';

export interface ThemeSettings {
  v: 1;
  /** A preset id, a saved palette id, or 'custom' (generated / fine-tuned). */
  paletteId: string;
  palette: Palette;
  gen: GenParams;
  oled: boolean;
  accentGradient: boolean;
  bg: BgStyle;
  font: FontId;
  promptFont: PromptFont;
  /** Whole-UI size, 0.9 … 1.25. */
  scale: number;
  density: Density;
  /** Corner radius of cards / panels / fields, × 0.4 … 1.6. */
  corners: number;
  /** Button rounding: radius = half the height × this (0 square … 1 pill). The --il-btn-round token. */
  btnRound: number;
  shadows: Shadows;
  /** Glass surfaces (dock, floating bars): blur px and how opaque. */
  glassBlur: number;
  glassAlpha: number;
  motion: Motion;
  speed: Speed;
}

export const DEFAULT_THEME: ThemeSettings = {
  v: 1, paletteId: 'ember', palette: EMBER, gen: DEFAULT_GEN, oled: false, accentGradient: false, bg: 'none',
  font: 'manrope', promptFont: 'ui', scale: 1, density: 'cozy', corners: 1, btnRound: 0.85, shadows: 'soft',
  glassBlur: 18, glassAlpha: 0.72, motion: 'full', speed: 'normal',
};

export const SCALE_MIN = 0.9;
export const SCALE_MAX = 1.25;
export const CORNERS_MIN = 0.4;
export const CORNERS_MAX = 1.6;

const oneOf = <V extends string>(v: unknown, all: readonly V[], d: V): V => (all.includes(v as V) ? (v as V) : d);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);

export function sanitizePalette(raw: unknown, base: Palette = EMBER): Palette {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...base };
  for (const k of PALETTE_KEYS) {
    const v = src[k];
    if (isHex(v)) out[k] = rgbToHex(hexToRgb(v));
  }
  return out;
}

export function sanitizeGen(raw: unknown): GenParams {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    seed: isHex(g.seed) ? rgbToHex(hexToRgb(g.seed)) : DEFAULT_GEN.seed,
    tint: num(g.tint, 0, 1, DEFAULT_GEN.tint),
    depth: oneOf(g.depth, ['deep', 'dark', 'dim'] as const, 'dark'),
    contrast: oneOf(g.contrast, ['soft', 'normal', 'high'] as const, 'normal'),
    harmony: oneOf(g.harmony, ['near', 'opposite', 'triad', 'custom'] as const, 'near'),
    ...(isHex(g.second) ? { second: rgbToHex(hexToRgb(g.second)) } : {}),
  };
}

/** Any stored or imported object → a complete, valid theme (unknown keys dropped, numbers clamped). */
export function sanitizeTheme(raw: unknown): ThemeSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_THEME;
  return {
    v: 1,
    paletteId: typeof r.paletteId === 'string' && r.paletteId ? r.paletteId.slice(0, 64) : d.paletteId,
    palette: sanitizePalette(r.palette),
    gen: sanitizeGen(r.gen),
    oled: typeof r.oled === 'boolean' ? r.oled : d.oled,
    accentGradient: typeof r.accentGradient === 'boolean' ? r.accentGradient : d.accentGradient,
    bg: oneOf(r.bg, ['none', 'glow', 'aurora', 'fade'] as const, d.bg),
    font: oneOf(r.font, ['manrope', 'inter', 'system'] as const, d.font),
    promptFont: oneOf(r.promptFont, ['ui', 'mono'] as const, d.promptFont),
    scale: num(r.scale, SCALE_MIN, SCALE_MAX, d.scale),
    density: oneOf(r.density, ['compact', 'cozy', 'roomy'] as const, d.density),
    corners: num(r.corners, CORNERS_MIN, CORNERS_MAX, d.corners),
    btnRound: num(r.btnRound, 0, 1, d.btnRound),
    shadows: oneOf(r.shadows, ['none', 'soft', 'deep'] as const, d.shadows),
    glassBlur: num(r.glassBlur, 0, 40, d.glassBlur),
    glassAlpha: num(r.glassAlpha, 0.3, 1, d.glassAlpha),
    motion: oneOf(r.motion, ['full', 'subtle', 'off'] as const, d.motion),
    speed: oneOf(r.speed, ['slow', 'normal', 'fast'] as const, d.speed),
  };
}

export const DENSITY_FACTOR: Record<Density, number> = { compact: 0.7, cozy: 1, roomy: 1.3 };
export const MOTION_FACTOR: Record<Motion, number> = { full: 1, subtle: 0.5, off: 0 };
export const SPEED_FACTOR: Record<Speed, number> = { slow: 1.6, normal: 1, fast: 0.6 };

export const FONTS: Record<FontId, { label: string; stack: string }> = {
  manrope: { label: 'Manrope', stack: '"Manrope Variable", Manrope, system-ui, sans-serif' },
  inter: { label: 'Inter', stack: '"Inter Variable", Inter, system-ui, sans-serif' },
  system: { label: 'System', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
};
export const MONO_STACK = 'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace';

const SHADOWS: Record<Shadows, { sm: string; md: string; lg: string; glow: string }> = {
  none: { sm: 'none', md: 'none', lg: 'none', glow: '0%' },
  soft: { sm: '0 2px 8px rgba(0,0,0,.4)', md: '0 8px 24px rgba(0,0,0,.4)', lg: '0 14px 40px rgba(0,0,0,.45)', glow: '35%' },
  deep: { sm: '0 4px 14px rgba(0,0,0,.55)', md: '0 14px 36px rgba(0,0,0,.6)', lg: '0 24px 64px rgba(0,0,0,.7)', glow: '55%' },
};

export const BG_ART: Record<BgStyle, string> = {
  none: 'none',
  glow: 'radial-gradient(1100px 640px at 0% 0%, color-mix(in srgb, var(--il-ember) 15%, transparent), transparent 70%)',
  aurora: 'radial-gradient(900px 560px at 0% 0%, color-mix(in srgb, var(--il-ember) 14%, transparent), transparent 70%), radial-gradient(900px 560px at 100% 100%, color-mix(in srgb, var(--il-accent2) 12%, transparent), transparent 70%)',
  fade: 'linear-gradient(180deg, color-mix(in srgb, var(--il-ember) 9%, transparent), transparent 45%)',
};

/** The colours in use: the palette, OLED applied when on. */
export const effectivePalette = (s: ThemeSettings): Palette => (s.oled ? oledify(s.palette) : s.palette);

/** Dark text or white on the accent, whichever reads better. */
export const onAccent = (p: Palette): string => (contrast(p.ember, p.bgDeep) >= contrast(p.ember, '#FFFFFF') ? p.bgDeep : '#FFFFFF');

/**
 * Everything one theme sets on <html>: CSS vars (`vars`) and data-attributes (`data`, read by
 * styles/theme.css). Motion is a data-attribute, not a var, so the reduced-motion media rule
 * can still win over it.
 */
export function themeVars(s: ThemeSettings): { vars: Record<string, string>; data: Record<string, string | null> } {
  const p = effectivePalette(s);
  const vars: Record<string, string> = {};
  for (const k of PALETTE_KEYS) vars[cssVarOf(k)] = p[k];
  const sh = SHADOWS[s.shadows];
  Object.assign(vars, {
    '--il-on-accent': onAccent(p),
    '--il-accent-fill': s.accentGradient ? 'linear-gradient(135deg, var(--il-ember), var(--il-accent2))' : 'linear-gradient(var(--il-ember), var(--il-ember))',
    '--il-bg-art': BG_ART[s.bg],
    '--il-font': FONTS[s.font].stack,
    '--il-font-prompt': s.promptFont === 'mono' ? MONO_STACK : 'var(--il-font)',
    '--il-density': String(DENSITY_FACTOR[s.density]),
    '--il-corners': String(s.corners),
    '--il-btn-round': String(s.btnRound),
    '--il-shadow-sm': sh.sm, '--il-shadow-md': sh.md, '--il-shadow-lg': sh.lg, '--il-glow': sh.glow,
    '--il-blur': `blur(${Math.round(s.glassBlur)}px)`,
    '--il-glass-pct': `${Math.round(s.glassAlpha * 100)}%`,
    '--il-dur': String(SPEED_FACTOR[s.speed]),
    '--il-scale': String(s.scale),
  });
  const data: Record<string, string | null> = {
    motion: s.motion === 'full' ? null : s.motion,
    grad: s.accentGradient ? 'accent' : null,
    bg: s.bg === 'none' ? null : s.bg,
    oled: s.oled ? 'on' : null,
    promptFont: s.promptFont === 'mono' ? 'mono' : null,
    shadows: s.shadows === 'soft' ? null : s.shadows,
  };
  return { vars, data };
}

// ---- import / export ------------------------------------------------------------------------

export const EXPORT_KIND = 'imagelab-theme';

export interface ThemeFile { kind: typeof EXPORT_KIND; v: 1; name: string; theme: ThemeSettings }

export function exportTheme(s: ThemeSettings, name: string): ThemeFile {
  return { kind: EXPORT_KIND, v: 1, name: name.trim() || 'My theme', theme: s };
}

/** JSON text → a theme + its name, or an error message. A bare theme object (no wrapper) or a bare palette is accepted too. */
export function parseThemeFile(text: string): { ok: true; name: string; theme: ThemeSettings } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That is not valid JSON.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'That file holds no theme.' };
  const o = raw as Record<string, unknown>;
  if (o.kind === EXPORT_KIND && o.theme && typeof o.theme === 'object') {
    return { ok: true, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : 'Imported', theme: sanitizeTheme(o.theme) };
  }
  if (o.palette && typeof o.palette === 'object') return { ok: true, name: 'Imported', theme: sanitizeTheme(o) };
  if (PALETTE_KEYS.some((k) => isHex(o[k]))) return { ok: true, name: 'Imported', theme: sanitizeTheme({ palette: o, paletteId: 'custom' }) };
  return { ok: false, error: 'That file holds no theme.' };
}
