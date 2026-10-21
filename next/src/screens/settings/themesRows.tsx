/**
 * Settings → Themes (item 35): every row of the Themes category, in page order, for the search,
 * the desktop pane and the phone. Each control writes the theme store (theme/themeStore.ts),
 * which applies it to the whole app at once. Pictures over words: most choices are tiles that
 * show the result.
 */
import type { CSSProperties } from 'react';
import { useTheme } from '~/theme/themeStore';
import { scaleSupported } from '~/theme/applyTheme';
import {
  BG_ART, CORNERS_MAX, DEFAULT_THEME, CORNERS_MIN, FONTS, SCALE_MAX, SCALE_MIN,
  type BgStyle, type Density, type FontId, type Motion, type PromptFont, type Shadows, type Speed,
} from '~/theme/themeModel';
import { Switch } from '~/ui';
import type { SettingDef } from './categories';
import { Seg, ThemeSlider, Tiles, type TileOption } from './themes/bits';
import { Generator } from './themes/Generator';
import { PaletteGallery } from './themes/PaletteGallery';
import { SharePanel } from './themes/SharePanel';
import { TokenEditor, useFineTune } from './themes/TokenEditor';

const G_COLOURS = 'Colours';
const G_TEXT = 'Text & size';
const G_SHAPE = 'Shape & depth';
const G_MOTION = 'Motion';
const G_SHARE = 'Share';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fill: CSSProperties = { position: 'absolute', inset: 0 };

// ---- colours ------------------------------------------------------------------------------

function GeneratorCtl() {
  const open = useFineTune((s) => s.setOpen);
  return <Generator onFineTune={() => open(true)} />;
}

function OledCtl() {
  const oled = useTheme((s) => s.theme.oled);
  const set = useTheme((s) => s.set);
  return <Switch label="" checked={oled} onChange={(v) => set({ oled: v })} />;
}

const GRADIENTS: ReadonlyArray<TileOption<'solid' | 'gradient'>> = [
  { value: 'solid', label: 'Solid', pic: <span style={{ ...fill, background: 'var(--il-ember)' }} /> },
  { value: 'gradient', label: 'Gradient', pic: <span style={{ ...fill, background: 'linear-gradient(135deg, var(--il-ember), var(--il-accent2))' }} /> },
];

function GradientCtl() {
  const on = useTheme((s) => s.theme.accentGradient);
  const set = useTheme((s) => s.set);
  return <Tiles label="Accent fill" value={on ? 'gradient' : 'solid'} options={GRADIENTS} onChange={(v) => set({ accentGradient: v === 'gradient' })} />;
}

const BGS: ReadonlyArray<TileOption<BgStyle>> = (['none', 'glow', 'aurora', 'fade'] as const).map((b) => ({
  value: b, label: b === 'none' ? 'Plain' : b[0].toUpperCase() + b.slice(1),
  pic: <span style={{ ...fill, backgroundColor: 'var(--il-bg)', backgroundImage: BG_ART[b].replace(/\d+px \d+px at/g, '120px 70px at') }} />,
}));

function BackgroundCtl() {
  const bg = useTheme((s) => s.theme.bg);
  const set = useTheme((s) => s.set);
  return <Tiles label="Background" value={bg} options={BGS} onChange={(v) => set({ bg: v })} />;
}

// ---- text & size --------------------------------------------------------------------------

const FONT_TILES: ReadonlyArray<TileOption<FontId>> = (Object.keys(FONTS) as FontId[]).map((f) => ({
  value: f, label: FONTS[f].label,
  pic: <span style={{ ...fill, display: 'grid', placeItems: 'center', fontFamily: FONTS[f].stack, fontSize: 20, fontWeight: 800, color: 'var(--il-fg)' }}>Aa</span>,
}));

function FontCtl() {
  const font = useTheme((s) => s.theme.font);
  const set = useTheme((s) => s.set);
  return <Tiles label="Font" value={font} options={FONT_TILES} onChange={(v) => set({ font: v })} />;
}

function PromptFontCtl() {
  const v = useTheme((s) => s.theme.promptFont);
  const set = useTheme((s) => s.set);
  return <Seg<PromptFont> label="Prompt font" value={v} options={[{ value: 'ui', label: 'Same' }, { value: 'mono', label: 'Mono' }]} onChange={(promptFont) => set({ promptFont })} />;
}

function ScaleValue() {
  const v = useTheme((s) => s.theme.scale);
  return <>{pct(v)}</>;
}

function ScaleCtl() {
  const v = useTheme((s) => s.theme.scale);
  const set = useTheme((s) => s.set);
  if (!scaleSupported) return <span style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 600 }}>This browser cannot scale the page; use its own zoom (Ctrl + / −).</span>;
  return <ThemeSlider label="UI size" defaultValue={DEFAULT_THEME.scale * 100} value={Math.round(v * 100)} min={SCALE_MIN * 100} max={SCALE_MAX * 100} step={5} presets={[90, 100, 110, 125]} fmt={(x) => `${x}%`} onChange={(x) => set({ scale: x / 100 })} />;
}

function DensityCtl() {
  const v = useTheme((s) => s.theme.density);
  const set = useTheme((s) => s.set);
  return <Seg<Density> label="Density" value={v} options={[{ value: 'compact', label: 'Compact' }, { value: 'cozy', label: 'Cozy' }, { value: 'roomy', label: 'Roomy' }]} onChange={(density) => set({ density })} />;
}

// ---- shape & depth -------------------------------------------------------------------------

function CornersValue() {
  const v = useTheme((s) => s.theme.corners);
  return <>{pct(v)}</>;
}

function CornersCtl() {
  const v = useTheme((s) => s.theme.corners);
  const set = useTheme((s) => s.set);
  return <ThemeSlider label="Corners" defaultValue={DEFAULT_THEME.corners * 100} value={Math.round(v * 100)} min={CORNERS_MIN * 100} max={CORNERS_MAX * 100} step={10} presets={[40, 70, 100, 130, 160]} fmt={(x) => (x === 40 ? 'Sharp' : x === 160 ? 'Round' : `${x}%`)} onChange={(x) => set({ corners: x / 100 })} />;
}

function ButtonsValue() {
  const v = useTheme((s) => s.theme.btnRound);
  return <>{v >= 1 ? 'Pill' : v <= 0 ? 'Square' : pct(v)}</>;
}

function ButtonsCtl() {
  const v = useTheme((s) => s.theme.btnRound);
  const set = useTheme((s) => s.set);
  return <ThemeSlider label="Button rounding" defaultValue={DEFAULT_THEME.btnRound * 100} value={Math.round(v * 100)} min={0} max={100} step={5} presets={[0, 50, 85, 100]} fmt={(x) => (x === 0 ? 'Square' : x === 100 ? 'Pill' : `${x}%`)} onChange={(x) => set({ btnRound: x / 100 })} />;
}

function ShadowsCtl() {
  const v = useTheme((s) => s.theme.shadows);
  const set = useTheme((s) => s.set);
  return <Seg<Shadows> label="Shadows" value={v} options={[{ value: 'none', label: 'None' }, { value: 'soft', label: 'Soft' }, { value: 'deep', label: 'Deep' }]} onChange={(shadows) => set({ shadows })} />;
}

function GlassCtl() {
  const blur = useTheme((s) => s.theme.glassBlur);
  const alpha = useTheme((s) => s.theme.glassAlpha);
  const set = useTheme((s) => s.set);
  const lbl: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', display: 'flex', justifyContent: 'space-between' };
  return (
    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={lbl}>Blur<span>{blur}px</span></span>
        <ThemeSlider label="Glass blur" defaultValue={DEFAULT_THEME.glassBlur} value={blur} min={0} max={40} step={2} fmt={(x) => `${x}px`} onChange={(glassBlur) => set({ glassBlur })} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={lbl}>See-through<span>{100 - Math.round(alpha * 100)}%</span></span>
        <ThemeSlider label="Glass see-through" defaultValue={100 - Math.round(DEFAULT_THEME.glassAlpha * 100)} value={100 - Math.round(alpha * 100)} min={0} max={70} step={2} fmt={(x) => `${x}%`} onChange={(x) => set({ glassAlpha: (100 - x) / 100 })} />
      </div>
    </div>
  );
}

// ---- motion -------------------------------------------------------------------------------

const MOTIONS: ReadonlyArray<TileOption<Motion>> = ([['full', 'Full', 1], ['subtle', 'Subtle', 0.5], ['off', 'Off', 0]] as const).map(([value, label, d]) => ({
  value, label,
  pic: (
    <span style={{ ...fill, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
      <span className={d ? 'il-motion-demo' : undefined} style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--il-ember)', ['--il-motion-demo' as string]: d } as CSSProperties} />
    </span>
  ),
}));

function MotionCtl() {
  const v = useTheme((s) => s.theme.motion);
  const set = useTheme((s) => s.set);
  return <Tiles label="Animations" value={v} options={MOTIONS} onChange={(motion) => set({ motion })} />;
}

function SpeedCtl() {
  const v = useTheme((s) => s.theme.speed);
  const set = useTheme((s) => s.set);
  return <Seg<Speed> label="Speed" value={v} options={[{ value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' }]} onChange={(speed) => set({ speed })} />;
}

export const THEMES_ROWS: readonly SettingDef[] = [
  {
    id: 'themes.palette', category: 'themes', group: G_COLOURS, label: 'Palette', wide: true,
    hint: 'Tap one to use it. On a computer, rest the pointer on one to preview it.',
    keywords: ['colour', 'color', 'scheme', 'preset', 'saved', 'ember', 'ocean', 'violet', 'theme'], Control: PaletteGallery,
  },
  {
    id: 'themes.generator', category: 'themes', group: G_COLOURS, label: 'Make your own', wide: true,
    hint: 'Pick one colour; every other colour is made from it.',
    keywords: ['generator', 'accent', 'seed', 'picker', 'tint', 'darkness', 'contrast', 'shuffle', 'random', 'second colour', 'harmony'], Control: GeneratorCtl,
  },
  {
    id: 'themes.finetune', category: 'themes', group: G_COLOURS, label: 'Fine-tune each colour', wide: true,
    hint: 'Every colour the app uses, one by one.',
    keywords: ['token', 'hex', 'custom', 'edit', 'background', 'text', 'border'], Control: TokenEditor,
  },
  {
    id: 'themes.oled', category: 'themes', group: G_COLOURS, label: 'OLED black', compact: true,
    hint: 'Pure black backgrounds on top of any palette. Saves battery on OLED screens.',
    keywords: ['amoled', 'black', 'dark', 'battery', 'night'], Control: OledCtl,
  },
  {
    id: 'themes.gradient', category: 'themes', group: G_COLOURS, label: 'Accent fill', wide: true,
    hint: 'Buttons, badges and progress bars in the accent, or a gradient to the second colour.',
    keywords: ['gradient', 'accent', 'buttons'], Control: GradientCtl,
  },
  {
    id: 'themes.background', category: 'themes', group: G_COLOURS, label: 'Background', wide: true,
    hint: 'A soft wash of colour behind the whole app.',
    keywords: ['gradient', 'glow', 'aurora', 'wallpaper'], Control: BackgroundCtl,
  },
  {
    id: 'themes.font', category: 'themes', group: G_TEXT, label: 'Font', wide: true,
    hint: 'The typeface of the whole app.', keywords: ['typeface', 'manrope', 'inter', 'system', 'text'], Control: FontCtl,
  },
  {
    id: 'themes.promptFont', category: 'themes', group: G_TEXT, label: 'Prompt font', compact: true,
    hint: 'Monospace makes long prompts easier to scan.', keywords: ['monospace', 'mono', 'typeface', 'prompt'], Control: PromptFontCtl,
  },
  {
    id: 'themes.scale', category: 'themes', group: G_TEXT, label: 'UI size', wide: true,
    hint: 'Everything bigger or smaller, from 90% to 125%.', keywords: ['scale', 'zoom', 'bigger', 'smaller', 'size'], Control: ScaleCtl, Value: ScaleValue,
  },
  {
    id: 'themes.density', category: 'themes', group: G_TEXT, label: 'Density', compact: true,
    hint: 'The space between things.', keywords: ['spacing', 'compact', 'roomy', 'padding', 'gap'], Control: DensityCtl,
  },
  {
    id: 'themes.corners', category: 'themes', group: G_SHAPE, label: 'Corners', wide: true,
    hint: 'How round cards, panels and boxes are.', keywords: ['radius', 'rounding', 'round', 'sharp'], Control: CornersCtl, Value: CornersValue,
  },
  {
    id: 'themes.buttons', category: 'themes', group: G_SHAPE, label: 'Button rounding', wide: true,
    hint: 'From square to a full pill.', keywords: ['radius', 'pill', 'round', 'buttons'], Control: ButtonsCtl, Value: ButtonsValue,
  },
  {
    id: 'themes.shadows', category: 'themes', group: G_SHAPE, label: 'Shadows', compact: true,
    hint: 'Under menus, pop-ups and windows.', keywords: ['depth', 'elevation', 'shadow'], Control: ShadowsCtl,
  },
  {
    id: 'themes.glass', category: 'themes', group: G_SHAPE, label: 'Glass', wide: true,
    hint: 'The floating bars: how blurred and how see-through.', keywords: ['blur', 'transparent', 'frosted', 'opacity', 'dock'], Control: GlassCtl,
  },
  {
    id: 'themes.motion', category: 'themes', group: G_MOTION, label: 'Animations', wide: true,
    hint: 'Hover, press and pop-up motion. The viewer and new images are always instant; your system’s reduce-motion setting always wins.',
    keywords: ['animation', 'motion', 'reduce', 'off', 'transitions', 'gsap'], Control: MotionCtl,
  },
  {
    id: 'themes.speed', category: 'themes', group: G_MOTION, label: 'Speed', compact: true,
    hint: 'How long each animation takes.', keywords: ['animation', 'fast', 'slow', 'duration'], Control: SpeedCtl,
  },
  {
    id: 'themes.share', category: 'themes', group: G_SHARE, label: 'Import, export, reset', wide: true,
    hint: 'A theme is one JSON file: save it, share it, load one.', keywords: ['json', 'file', 'backup', 'share', 'reset', 'default'], Control: SharePanel,
  },
];
