/**
 * The app's logo (fix list 47, logo part): three modern marks + wordmarks. Spark ships; Frame and
 * Prism stay one tap away in Settings → Appearance → Logo so Donny can pick. The choice drives
 * the top-left mark, the wordmark and the browser favicon (`useLogoFavicon`); the PWA icons in
 * public/icons are Spark (static files, made from `markSvg('spark')`).
 *
 * The favicon hand-off with the engine's live favicon (`jobProgress.ts`): this sets the icon
 * link's `data-base` to the chosen mark, and the engine shows that whenever no job is live.
 */
import { useEffect, type CSSProperties } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LogoId = 'spark' | 'frame' | 'prism';

const INK = '#141416';
const EMBER = '#F0863A';
const EMBER_HI = '#FFB36B';

/** The mark as a standalone 32×32 SVG (tile included): the favicon, the PWA icons and the top bar use the same drawing. */
export function markSvg(id: LogoId): string {
  switch (id) {
    case 'frame':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        + '<rect width="32" height="32" rx="9" fill="#1C1C21"/><rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke="#2F2F38"/>'
        + `<rect x="6.5" y="6.5" width="15" height="15" rx="4.2" fill="none" stroke="${EMBER}" stroke-width="2.8"/>`
        + `<circle cx="21.5" cy="21.5" r="5.6" fill="#1C1C21"/><circle cx="21.5" cy="21.5" r="4.2" fill="${EMBER}"/></svg>`;
    case 'prism':
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${EMBER_HI}"/><stop offset="1" stop-color="${EMBER}"/></linearGradient></defs>`
        + '<rect width="32" height="32" rx="9" fill="url(#g)"/>'
        + `<path d="M3.5 17.5H11" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
        + `<path d="M15 7.5l7.5 15h-15z" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<path d="M20.5 15.5l7.5-2.6M21.5 18h7M20.5 20.5l7.5 2.6" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/></svg>`;
    default:
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        + `<rect width="32" height="32" rx="9" fill="${EMBER}"/>`
        + `<path d="M14 5.5c1 5.3 3.2 7.5 8.5 8.5-5.3 1-7.5 3.2-8.5 8.5-1-5.3-3.2-7.5-8.5-8.5 5.3-1 7.5-3.2 8.5-8.5z" fill="${INK}"/>`
        + `<circle cx="22.6" cy="22.6" r="2.7" fill="${INK}"/></svg>`;
  }
}

export const markDataUrl = (id: LogoId): string => `data:image/svg+xml,${encodeURIComponent(markSvg(id))}`;

export const LOGOS: ReadonlyArray<{ id: LogoId; name: string; caption: string }> = [
  { id: 'spark', name: 'Spark', caption: 'Ember tile, a dark four-point spark and a dot' },
  { id: 'frame', name: 'Frame', caption: 'Dark tile, an ember picture frame with a sun on its corner; lowercase wordmark' },
  { id: 'prism', name: 'Prism', caption: 'Warm gradient tile, a prism splitting one beam into three; spaced capitals' },
];

interface LogoState { logo: LogoId; setLogo: (id: LogoId) => void }

export const useLogo = create<LogoState>()(persist(
  (set) => ({ logo: 'spark', setLogo: (logo) => set({ logo }) }),
  { name: 'imagelab.next.logo.v1' },
));

/** The mark at a size. */
export function LogoMark({ size = 32, id, style }: { size?: number; id?: LogoId; style?: CSSProperties }) {
  const chosen = useLogo((s) => s.logo);
  return <img src={markDataUrl(id ?? chosen)} alt="" aria-hidden width={size} height={size} draggable={false} style={{ display: 'block', flex: 'none', ...style }} />;
}

/** The wordmark in the chosen style. */
export function LogoWordmark({ size = 17, id }: { size?: number; id?: LogoId }) {
  const chosen = useLogo((s) => s.logo);
  const which = id ?? chosen;
  const base: CSSProperties = { fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1, color: 'var(--il-fg)' };
  if (which === 'frame') return <span style={{ ...base, fontSize: size, letterSpacing: '-.6px' }}>imagelab<span style={{ color: 'var(--il-ember)' }}>.</span></span>;
  if (which === 'prism') return <span style={{ ...base, fontSize: Math.round(size * 0.82), letterSpacing: '1.6px', textTransform: 'uppercase' }}>Image<span style={{ color: 'var(--il-ember)' }}>Lab</span></span>;
  return <span style={{ ...base, fontSize: size, letterSpacing: '-.4px' }}>Image<span style={{ color: 'var(--il-ember)' }}>Lab</span></span>;
}

/** Mount once (App): the favicon follows the chosen logo while nothing is running. */
export function useLogoFavicon(): void {
  const logo = useLogo((s) => s.logo);
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    const href = markDataUrl(logo);
    const prev = link.dataset.base;
    link.dataset.base = href;
    // Swap only when the link shows the app's icon (not the engine's live job icon).
    const cur = link.getAttribute('href') ?? '';
    if (!cur.startsWith('data:') || cur === prev) link.setAttribute('href', href);
  }, [logo]);
}
