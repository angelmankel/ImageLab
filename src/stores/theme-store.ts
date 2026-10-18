import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ThemeId, FontId, FontWeight, GradientStyle, ThemeViewMode, CustomThemeConfig, BorderRadiusStyle, ShadowIntensity, SurfaceStyle, UIBorderStyle } from "@/modules/theme/types";

interface ThemeState {
  currentTheme: ThemeId;
  currentFont: FontId;
  fontWeight: FontWeight;
  gradientStyle: GradientStyle;
  /** Saved settings from before this existed get the default (OLED) on load: persist merges. */
  surfaceStyle: SurfaceStyle;
  borderRadiusStyle: BorderRadiusStyle;
  shadowIntensity: ShadowIntensity;
  uiBorderStyle: UIBorderStyle;
  themeViewMode: ThemeViewMode;
  customThemes: CustomThemeConfig[];
  setTheme: (themeId: ThemeId) => void;
  setFont: (fontId: FontId) => void;
  setFontWeight: (weight: FontWeight) => void;
  setGradientStyle: (style: GradientStyle) => void;
  setSurfaceStyle: (style: SurfaceStyle) => void;
  setBorderRadiusStyle: (style: BorderRadiusStyle) => void;
  setShadowIntensity: (intensity: ShadowIntensity) => void;
  setUIBorderStyle: (style: UIBorderStyle) => void;
  setThemeViewMode: (mode: ThemeViewMode) => void;
  addCustomTheme: (theme: CustomThemeConfig) => void;
  removeCustomTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentTheme: "imagelab-studio",
      currentFont: "inter",
      fontWeight: 400,
      gradientStyle: "default",
      surfaceStyle: "oled",
      borderRadiusStyle: "subtle",
      shadowIntensity: "normal",
      uiBorderStyle: "visible",
      themeViewMode: "grid",
      customThemes: [],
      setTheme: (themeId) => set({ currentTheme: themeId }),
      setFont: (fontId) => set({ currentFont: fontId }),
      setFontWeight: (weight) => set({ fontWeight: weight }),
      setGradientStyle: (style) => set({ gradientStyle: style }),
      setSurfaceStyle: (style) => set({ surfaceStyle: style }),
      setBorderRadiusStyle: (style) => set({ borderRadiusStyle: style }),
      setShadowIntensity: (intensity) => set({ shadowIntensity: intensity }),
      setUIBorderStyle: (style) => set({ uiBorderStyle: style }),
      setThemeViewMode: (mode) => set({ themeViewMode: mode }),
      addCustomTheme: (theme) =>
        set((state) => ({ customThemes: [...state.customThemes, theme] })),
      removeCustomTheme: (themeId) =>
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.id !== themeId),
          currentTheme: state.currentTheme === themeId ? "imagelab-studio" : state.currentTheme,
        })),
    }),
    {
      name: "imagelab-theme-storage",
    }
  )
);
