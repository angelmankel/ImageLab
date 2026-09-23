import { MantineColorsTuple } from "@mantine/core";

/**
 * Blends a hex color with a base color
 * @param baseColor - Base hex color (e.g., "#1f2127")
 * @param blendColor - Color to blend in (e.g., "#7950f2")
 * @param amount - Blend amount 0-1 (e.g., 0.05 for 5%)
 */
export function blendColors(
  baseColor: string,
  blendColor: string,
  amount: number
): string {
  const hex = (color: string) => parseInt(color.replace("#", ""), 16);
  const base = hex(baseColor);
  const blend = hex(blendColor);

  const r1 = (base >> 16) & 0xff;
  const g1 = (base >> 8) & 0xff;
  const b1 = base & 0xff;

  const r2 = (blend >> 16) & 0xff;
  const g2 = (blend >> 8) & 0xff;
  const b2 = blend & 0xff;

  const r = Math.round(r1 * (1 - amount) + r2 * amount);
  const g = Math.round(g1 * (1 - amount) + g2 * amount);
  const b = Math.round(b1 * (1 - amount) + b2 * amount);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Creates a dark color palette with primary color blending
 * @param primaryColor - Primary color to blend (base shade)
 */
export function createDarkPalette(primaryColor: string): MantineColorsTuple {
  return [
    "#c1c2c5", // 0 - lightest text (no blending - needs contrast)
    "#a6a7ab", // 1 - text (no blending)
    "#909296", // 2 - dimmed text (no blending)
    "#5c5f66", // 3 - placeholder text (no blending)
    blendColors("#2a2c31", primaryColor, 0.03), // 4 - borders (subtle blend)
    blendColors("#1f2127", primaryColor, 0.025), // 5 - panels/cards
    blendColors("#1d1e22", primaryColor, 0.02), // 6 - header/footer/inputs
    blendColors("#1a1b1e", primaryColor, 0.015), // 7 - main background
    blendColors("#141517", primaryColor, 0.01), // 8 - darker
    blendColors("#101113", primaryColor, 0.005), // 9 - darkest (very subtle)
  ];
}

/**
 * Lightens a color by a percentage
 */
function lighten(color: string, amount: number): string {
  const hex = parseInt(color.replace("#", ""), 16);
  const r = Math.min(255, ((hex >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((hex >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (hex & 0xff) + Math.round(255 * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Darkens a color by a percentage
 */
function darken(color: string, amount: number): string {
  const hex = parseInt(color.replace("#", ""), 16);
  const r = Math.max(0, ((hex >> 16) & 0xff) - Math.round(255 * amount));
  const g = Math.max(0, ((hex >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (hex & 0xff) - Math.round(255 * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generates a full color palette from a base color
 * @param baseColor - Base hex color (shade 6)
 */
export function generateColorPalette(baseColor: string): MantineColorsTuple {
  return [
    lighten(baseColor, 0.45), // 0 - lightest
    lighten(baseColor, 0.38), // 1
    lighten(baseColor, 0.3), // 2
    lighten(baseColor, 0.22), // 3
    lighten(baseColor, 0.14), // 4
    lighten(baseColor, 0.07), // 5
    baseColor, // 6 - base
    darken(baseColor, 0.05), // 7
    darken(baseColor, 0.1), // 8
    darken(baseColor, 0.15), // 9 - darkest
  ];
}
