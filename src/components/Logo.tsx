/**
 * ImageLab brand mark — the same art as the favicon and app icon (public/icons/icon.svg): a
 * rounded tile in the theme's teal with two squares. The icon's full-bleed dark background is
 * left out here so the mark sits on whatever surface it is drawn on.
 */
type LogoProps = {
  /** Rendered width/height in px. Default 28 (the side-rail size). */
  size?: number;
  className?: string;
  /** Accessible name + tooltip. */
  title?: string;
};

export function Logo({ size = 28, className, title = 'ImageLab' }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="96 96 320 320" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="96" y="96" width="320" height="320" rx="72" fill="#24A6A9" />
      <rect x="148" y="148" width="100" height="100" rx="22" fill="#ffffff" />
      <rect x="264" y="264" width="100" height="100" rx="22" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  );
}
