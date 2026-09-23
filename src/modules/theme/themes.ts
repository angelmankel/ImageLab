import { ThemeConfig, CustomThemeConfig, FontConfig, FontId, FONT_OPTIONS } from "./types";
import { generateColorPalette } from "./utils";

/**
 * Ultraviolet theme (current default)
 */
export const ultravioletTheme: ThemeConfig = {
  id: "ultraviolet",
  name: "Ultraviolet",
  primaryColorName: "violet",
  primaryColor: [
    "#f3f0ff", // 0 - lightest
    "#e5dbff", // 1
    "#d0bfff", // 2
    "#b197fc", // 3
    "#9775fa", // 4
    "#845ef7", // 5
    "#7950f2", // 6 - primary shade
    "#7048e8", // 7
    "#6741d9", // 8
    "#5f3dc4", // 9 - darkest
  ],
};

/**
 * ImageLab Studio Theme (original default)
 */
export const imagelabStudioTheme: ThemeConfig = {
  id: "imagelab-studio",
  name: "ImageLab Studio Theme",
  primaryColorName: "imagelabStudio",
  primaryColor: generateColorPalette("#24A6A9"),
};

/**
 * Midnight Blue theme
 */
export const midnightBlueTheme: ThemeConfig = {
  id: "midnight-blue",
  name: "Midnight Blue",
  primaryColorName: "midnightBlue",
  primaryColor: generateColorPalette("#2443A9"),
};

/**
 * Halloween Orange theme
 */
export const halloweenOrangeTheme: ThemeConfig = {
  id: "halloween-orange",
  name: "Halloween Orange",
  primaryColorName: "halloweenOrange",
  primaryColor: generateColorPalette("#A95324"),
};

/**
 * Cyberpunk Red theme
 */
export const cyberpunkRedTheme: ThemeConfig = {
  id: "cyberpunk-red",
  name: "Cyberpunk Red",
  primaryColorName: "cyberpunkRed",
  primaryColor: generateColorPalette("#A92424"),
};

/**
 * Forest Green theme
 */
export const forestGreenTheme: ThemeConfig = {
  id: "forest-green",
  name: "Forest Green",
  primaryColorName: "forestGreen",
  primaryColor: generateColorPalette("#2E8B57"),
};

/**
 * Rose Pink theme
 */
export const rosePinkTheme: ThemeConfig = {
  id: "rose-pink",
  name: "Rose Pink",
  primaryColorName: "rosePink",
  primaryColor: generateColorPalette("#C2185B"),
};

/**
 * Golden Amber theme
 */
export const goldenAmberTheme: ThemeConfig = {
  id: "golden-amber",
  name: "Golden Amber",
  primaryColorName: "goldenAmber",
  primaryColor: generateColorPalette("#C8902E"),
};

/**
 * Ocean Teal theme
 */
export const oceanTealTheme: ThemeConfig = {
  id: "ocean-teal",
  name: "Ocean Teal",
  primaryColorName: "oceanTeal",
  primaryColor: generateColorPalette("#00838F"),
};

/**
 * Slate Gray theme
 */
export const slateGrayTheme: ThemeConfig = {
  id: "slate-gray",
  name: "Slate Gray",
  primaryColorName: "slateGray",
  primaryColor: generateColorPalette("#607D8B"),
};

/**
 * Neon Lime theme
 */
export const neonLimeTheme: ThemeConfig = {
  id: "neon-lime",
  name: "Neon Lime",
  primaryColorName: "neonLime",
  primaryColor: generateColorPalette("#76B900"),
};

/**
 * Electric Blue theme
 */
export const electricBlueTheme: ThemeConfig = {
  id: "electric-blue",
  name: "Electric Blue",
  primaryColorName: "electricBlue",
  primaryColor: generateColorPalette("#0080FF"),
};

/**
 * Sunset Coral theme
 */
export const sunsetCoralTheme: ThemeConfig = {
  id: "sunset-coral",
  name: "Sunset Coral",
  primaryColorName: "sunsetCoral",
  primaryColor: generateColorPalette("#E85D4A"),
};

/**
 * All available built-in themes
 */
export const themes: Record<string, ThemeConfig> = {
  ultraviolet: ultravioletTheme,
  "imagelab-studio": imagelabStudioTheme,
  "midnight-blue": midnightBlueTheme,
  "halloween-orange": halloweenOrangeTheme,
  "cyberpunk-red": cyberpunkRedTheme,
  "forest-green": forestGreenTheme,
  "rose-pink": rosePinkTheme,
  "golden-amber": goldenAmberTheme,
  "ocean-teal": oceanTealTheme,
  "slate-gray": slateGrayTheme,
  "neon-lime": neonLimeTheme,
  "electric-blue": electricBlueTheme,
  "sunset-coral": sunsetCoralTheme,
};

/**
 * Get theme by ID, optionally searching custom themes
 */
export function getTheme(themeId: string, customThemes?: CustomThemeConfig[]): ThemeConfig {
  if (themes[themeId]) {
    return themes[themeId];
  }
  if (customThemes) {
    const custom = customThemes.find((t) => t.id === themeId);
    if (custom) return custom;
  }
  return ultravioletTheme;
}

/**
 * Get font config by ID
 */
export function getFont(fontId: FontId): FontConfig | undefined {
  return FONT_OPTIONS.find((f) => f.id === fontId);
}
