import { MantineThemeOverride, MantineColorsTuple, MantineShadow, MantineSize } from "@mantine/core";
import { ThemeConfig, GradientStyle, BorderRadiusStyle, ShadowIntensity, UIBorderStyle } from "./types";
import { createDarkPalette } from "./utils";

/**
 * Returns the CSS background string for the AppShell.Main based on gradient style
 */
export function getMainBackground(gradientStyle: GradientStyle): string {
  switch (gradientStyle) {
    case "flat":
      return "var(--mantine-color-dark-8)";
    case "radial-glow":
      return "radial-gradient(ellipse at 50% 50%, var(--mantine-color-dark-5) 0%, var(--mantine-color-dark-8) 70%)";
    case "subtle-mesh":
      return [
        "radial-gradient(ellipse at 20% 20%, var(--mantine-color-dark-5) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 80%, var(--mantine-color-dark-6) 0%, transparent 50%)",
        "radial-gradient(ellipse at 60% 30%, var(--mantine-color-dark-7) 0%, transparent 40%)",
        "var(--mantine-color-dark-8)",
      ].join(", ");
    case "default":
    default:
      return "linear-gradient(to top, var(--mantine-color-dark-8) -50%, var(--mantine-color-dark-8) 15%, var(--mantine-color-dark-8) 60%, var(--mantine-color-dark-5) 100%)";
  }
}

// Static color palettes (not theme-dependent)
const green: MantineColorsTuple = [
  "#9ae8ce", // 0
  "#7ce0bc", // 1
  "#5ed8aa", // 2
  "#47d5a6", // 3
  "#3aba92", // 4
  "#2ea07d", // 5
  "#22946e", // 6 - base
  "#1d7d5d", // 7
  "#18664c", // 8
  "#13503c", // 9
];

const orange: MantineColorsTuple = [
  "#ecd7b2", // 0
  "#e5c797", // 1
  "#deb77c", // 2
  "#d7ac61", // 3
  "#ca9649", // 4
  "#bc8838", // 5
  "#a87a2a", // 6 - base
  "#8f6623", // 7
  "#76531d", // 8
  "#5d4016", // 9
];

const red: MantineColorsTuple = [
  "#eb9e9e", // 0
  "#e57f7f", // 1
  "#df6060", // 2
  "#d94a4a", // 3
  "#c13838", // 4
  "#ad2f2f", // 5
  "#9c2121", // 6 - base
  "#831c1c", // 7
  "#6a1616", // 8
  "#511111", // 9
];

const blue: MantineColorsTuple = [
  "#92b2e5", // 0
  "#739fd9", // 1
  "#5a8ccd", // 2
  "#4077d1", // 3
  "#3565b8", // 4
  "#2d569b", // 5
  "#21498a", // 6 - base
  "#1c3d73", // 7
  "#17315c", // 8
  "#122545", // 9
];

/**
 * Maps border radius style to Mantine's defaultRadius value
 */
function getDefaultRadius(style: BorderRadiusStyle): MantineSize | number {
  switch (style) {
    case "sharp": return 0;
    case "subtle": return "sm";
    case "rounded": return "md";
    case "pill": return "xl";
  }
}

/**
 * Maps shadow intensity to Mantine shadow overrides
 */
function getShadows(intensity: ShadowIntensity): Record<MantineShadow, string> | undefined {
  switch (intensity) {
    case "none":
      return { xs: "none", sm: "none", md: "none", lg: "none", xl: "none" };
    case "subtle":
      return {
        xs: "0 1px 2px rgba(0, 0, 0, 0.03)",
        sm: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
        md: "0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04)",
        lg: "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.04)",
        xl: "0 8px 10px rgba(0, 0, 0, 0.05), 0 3px 5px rgba(0, 0, 0, 0.04)",
      };
    case "normal":
      return undefined;
    case "dramatic":
      return {
        xs: "0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)",
        sm: "0 4px 8px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.12)",
        md: "0 8px 16px rgba(0, 0, 0, 0.25), 0 4px 8px rgba(0, 0, 0, 0.15)",
        lg: "0 12px 24px rgba(0, 0, 0, 0.3), 0 6px 12px rgba(0, 0, 0, 0.18)",
        xl: "0 20px 40px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.2)",
      };
  }
}

/**
 * Maps UI border style to border color and width values
 */
function getBorderStyles(style: UIBorderStyle): { color: string; width: string } {
  switch (style) {
    case "none": return { color: "transparent", width: "0px" };
    case "subtle": return { color: "var(--mantine-color-dark-5)", width: "1px" };
    case "visible": return { color: "var(--mantine-color-dark-4)", width: "1px" };
    case "strong": return { color: "var(--mantine-color-dark-3)", width: "2px" };
  }
}

/**
 * Creates a Mantine theme configuration from a ThemeConfig
 */
export function createMantineTheme(
  themeConfig: ThemeConfig,
  fontFamily?: string,
  gradientStyle: GradientStyle = "default",
  borderRadiusStyle: BorderRadiusStyle = "subtle",
  shadowIntensity: ShadowIntensity = "normal",
  uiBorderStyle: UIBorderStyle = "visible",
): MantineThemeOverride {
  const dark = createDarkPalette(themeConfig.primaryColor[6]);
  const shadows = getShadows(shadowIntensity);
  const border = getBorderStyles(uiBorderStyle);

  return {
    primaryColor: themeConfig.primaryColorName,
    fontFamily: fontFamily,
    headings: fontFamily ? { fontFamily } : undefined,
    colors: {
      [themeConfig.primaryColorName]: themeConfig.primaryColor,
      dark,
      green,
      orange,
      red,
      blue,
    },
    focusRing: "auto",
    focusClassName: "imagelab-focus-ring",
    defaultRadius: getDefaultRadius(borderRadiusStyle),
    ...(shadows ? { shadows } : {}),
    components: {
      // No stepper arrows on number inputs anywhere — type, scroll, or use the field's own buttons.
      NumberInput: {
        defaultProps: { hideControls: true },
      },
      AppShell: {
        styles: {
          header: {
            backgroundColor: "var(--mantine-color-dark-7)",
            borderBottom: `${border.width} solid ${border.color}`,
          },
          navbar: {
            backgroundColor: "var(--mantine-color-dark-6)",
            borderRight: `${border.width} solid ${border.color}`,
          },
          footer: {
            backgroundColor: "var(--mantine-color-dark-7)",
            borderTop: `${border.width} solid ${border.color}`,
          },
          main: {
            background: getMainBackground(gradientStyle),
          },
        },
      },
      Card: {
        styles: {
          root: {
            backgroundColor: "var(--mantine-color-dark-5)",
            borderColor: border.color,
            borderWidth: border.width,
          },
        },
      },
      Paper: {
        styles: {
          root: {
            backgroundColor: "var(--mantine-color-dark-5)",
            borderColor: border.color,
            borderWidth: border.width,
          },
        },
      },
      Modal: {
        styles: {
          content: {
            backgroundColor: "var(--mantine-color-dark-5)",
          },
          header: {
            backgroundColor: "var(--mantine-color-dark-6)",
            borderBottom: `${border.width} solid ${border.color}`,
          },
        },
      },
      Tooltip: {
        styles: {
          tooltip: {
            backgroundColor: "var(--mantine-color-dark-4)",
            color: "var(--mantine-color-white)",
            border: `${border.width} solid ${border.color}`,
          },
        },
      },
      Radio: {
        styles: {
          icon: {
            // Fix icon centering inside radio circle
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          },
        },
      },
    },
    other: {
      focusRingStyles: `
        .imagelab-focus-ring:focus-visible {
          outline: 2px solid var(--mantine-color-${themeConfig.primaryColorName}-6) !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 4px rgba(151, 117, 250, 0.25) !important;
        }
      `,
    },
  };
}
