/**
 * The app's logo: option D "Monolith" (approved by Donny 10-20, replaces fix list 47's Spark /
 * Frame / Prism picker). Geometry and SVG strings live in `monolith.ts`; this file is the React
 * side: the mark (in the text colour, cut subtracted so it sits on any background), the outlined
 * IMAGELAB wordmark, and the favicon.
 *
 * The favicon hand-off with the engine's live favicon (`jobProgress.ts`): this sets the icon
 * link's `data-base` to the blue tile, and the engine shows that whenever no job is live.
 */
import { useEffect, type CSSProperties } from 'react';
import { WORDMARK, cutFor, markPath, svgDataUrl, tileSvg, viewBoxFor } from './monolith';

/** The mark at a size (px), in `color` (default: the text colour). */
export function LogoMark({ size = 32, color = 'var(--il-fg)', style }: { size?: number; color?: string; style?: CSSProperties }) {
  const cut = cutFor(size);
  return (
    <svg aria-hidden width={size} height={size} viewBox={viewBoxFor(cut)} style={{ display: 'block', flex: 'none', ...style }}>
      <path d={markPath(cut)} fill={color} />
    </svg>
  );
}

/** "IMAGELAB" (IBM Plex Sans Condensed SemiBold, tracked 0.16em, outlined). `size` = the font size it stands for. */
export function LogoWordmark({ size = 17, color = 'var(--il-fg)' }: { size?: number; color?: string }) {
  const h = size * WORDMARK.capRatio;
  return (
    <svg role="img" aria-label="ImageLab" height={h} width={h * WORDMARK.aspect} viewBox={WORDMARK.viewBox} style={{ display: 'block', flex: 'none' }}>
      <path d={WORDMARK.d} fill={color} />
    </svg>
  );
}

/** The favicon (also the idle tab icon): the blue tile. */
export const FAVICON_HREF = svgDataUrl(tileSvg(32));

/** Mount once (App): the favicon is the logo tile while nothing is running. */
export function useLogoFavicon(): void {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    const prev = link.dataset.base;
    link.dataset.base = FAVICON_HREF;
    // Swap only when the link shows the app's icon (not the engine's live job icon).
    const cur = link.getAttribute('href') ?? '';
    if (!cur.startsWith('data:') || cur === prev) link.setAttribute('href', FAVICON_HREF);
  }, []);
}
