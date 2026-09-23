import { MantineColorsTuple } from "@mantine/core";

export type BuiltInThemeId =
  | "ultraviolet"
  | "imagelab-studio"
  | "midnight-blue"
  | "halloween-orange"
  | "cyberpunk-red"
  | "forest-green"
  | "rose-pink"
  | "golden-amber"
  | "ocean-teal"
  | "slate-gray"
  | "neon-lime"
  | "electric-blue"
  | "sunset-coral";

export type CustomThemeId = `custom-${string}`;

export type ThemeId = BuiltInThemeId | CustomThemeId;

export type FontId =
  | "system"
  | "inter"
  | "roboto"
  | "open-sans"
  | "fira-code"
  | "jetbrains-mono"
  | "source-sans"
  | "nunito";

export interface FontConfig {
  id: FontId;
  name: string;
  fontFamily: string;
  category: "sans-serif" | "monospace";
}

export const FONT_OPTIONS: FontConfig[] = [
  {
    id: "system",
    name: "System Default",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    category: "sans-serif",
  },
  {
    id: "inter",
    name: "Inter",
    fontFamily: "'Inter', sans-serif",
    category: "sans-serif",
  },
  {
    id: "roboto",
    name: "Roboto",
    fontFamily: "'Roboto', sans-serif",
    category: "sans-serif",
  },
  {
    id: "open-sans",
    name: "Open Sans",
    fontFamily: "'Open Sans', sans-serif",
    category: "sans-serif",
  },
  {
    id: "source-sans",
    name: "Source Sans 3",
    fontFamily: "'Source Sans 3', sans-serif",
    category: "sans-serif",
  },
  {
    id: "nunito",
    name: "Nunito",
    fontFamily: "'Nunito', sans-serif",
    category: "sans-serif",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    fontFamily: "'Fira Code', monospace",
    category: "monospace",
  },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    fontFamily: "'JetBrains Mono', monospace",
    category: "monospace",
  },
];

export type FontWeight = 400 | 500 | 600 | 700;

export const FONT_WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi-Bold" },
  { value: 700, label: "Bold" },
];

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  primaryColor: MantineColorsTuple;
  primaryColorName: string;
}

export interface CustomThemeConfig extends ThemeConfig {
  id: CustomThemeId;
  baseColor: string;
}

export type AnyThemeConfig = ThemeConfig | CustomThemeConfig;

export type GradientStyle = "default" | "flat" | "radial-glow" | "subtle-mesh";

export const GRADIENT_STYLE_OPTIONS: { value: GradientStyle; label: string; description: string }[] = [
  { value: "default", label: "Default Gradient", description: "Subtle vertical gradient from dark to slightly lighter" },
  { value: "flat", label: "Flat", description: "Solid dark background with no gradient" },
  { value: "radial-glow", label: "Radial Glow", description: "Soft radial glow from the center" },
  { value: "subtle-mesh", label: "Subtle Mesh", description: "Multi-point gradient mesh effect" },
];

export type ThemeViewMode = "grid" | "preview";

export type BorderRadiusStyle = "sharp" | "subtle" | "rounded" | "pill";
export const BORDER_RADIUS_OPTIONS: { value: BorderRadiusStyle; label: string; description: string }[] = [
  { value: "sharp", label: "Sharp", description: "Square corners with no border radius" },
  { value: "subtle", label: "Subtle", description: "Slightly rounded corners for a clean look" },
  { value: "rounded", label: "Rounded", description: "Noticeably rounded corners for a softer feel" },
  { value: "pill", label: "Pill", description: "Very rounded corners for a smooth, pill-like shape" },
];

export type ShadowIntensity = "none" | "subtle" | "normal" | "dramatic";
export const SHADOW_INTENSITY_OPTIONS: { value: ShadowIntensity; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No shadows for a completely flat appearance" },
  { value: "subtle", label: "Subtle", description: "Very light shadows for minimal depth" },
  { value: "normal", label: "Normal", description: "Standard shadow depth" },
  { value: "dramatic", label: "Dramatic", description: "Strong shadows for prominent depth and dimension" },
];

export type UIBorderStyle = "none" | "subtle" | "visible" | "strong";
export const UI_BORDER_STYLE_OPTIONS: { value: UIBorderStyle; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No visible borders for a clean, borderless look" },
  { value: "subtle", label: "Subtle", description: "Faint borders that are barely visible" },
  { value: "visible", label: "Visible", description: "Standard visible borders (default)" },
  { value: "strong", label: "Strong", description: "Bold, prominent borders for clear separation" },
];
