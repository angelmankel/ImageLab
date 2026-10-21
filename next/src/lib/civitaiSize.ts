/**
 * Fix list 2, performance pass: which CivitAI rendition each slot asks for.
 *
 * The image CDN snaps any `width=N` up to one of a few renditions (measured 10-20: 320, 450, 800,
 * 1200, 1600, 2200 px wide) and happily UPSCALES past the original: `width=2048` on a 1024 px
 * sample came back 2200 × 3300 (7.3 MP to decode, 1 MB) for no extra detail. So a big slot asks
 * for the smallest rendition that still holds every original pixel (`fullWidth`), and the model
 * viewer's picture and the full-screen viewer ask for the SAME width when they can, so paging
 * downloads and decodes each sample once. Small slots (tiles, strips) keep their width and take
 * the CDN's WebP (`optimized=true`, about a third of the bytes; same pixels).
 */
import { civitaiThumbUrl, civitaiVideoUrl, isCivitaiVideo, previewStill } from '@/lib/civitai';

/** The widths the CDN renders (it rounds a request up to the next one). */
export const CIVITAI_RENDITIONS = [320, 450, 800, 1200, 1600, 2200] as const;
const LARGEST = CIVITAI_RENDITIONS[CIVITAI_RENDITIONS.length - 1];

/** The rendition a `width=want` request comes back as. */
export function renditionFor(want: number): number {
  for (const w of CIVITAI_RENDITIONS) if (want <= w) return w;
  return LARGEST;
}

/**
 * The width to ask for so the rendition is no bigger than `cap` and no bigger than the smallest
 * one that holds the original (`original` px wide; unknown = 0 → `cap`).
 */
export function fullWidth(original: number | null | undefined, cap: number = LARGEST): number {
  const top = renditionFor(cap);
  if (!original || original <= 0) return top;
  return Math.min(top, renditionFor(original));
}

interface Sample { url?: string; type?: string; width?: number | null }

/** A big still (the model viewer's picture, the full-screen viewer) at `fullWidth`. */
export function civitaiFullUrl(img: Sample, cap: number = LARGEST): string {
  const w = fullWidth(img.width ?? 0, cap);
  return civitaiThumbUrl(previewStill(img, w), w);
}

/** A clip for a big slot (same width rule as the stills). */
export function civitaiFullVideoUrl(img: Sample, cap: number = LARGEST): string {
  return civitaiVideoUrl(img.url ?? '', fullWidth(img.width ?? 0, cap));
}

/** A small still (tile, strip, masonry) at `width`, as the CDN's WebP. Clips give their still. */
export function civitaiSmallUrl(img: Sample | string, width: number): string {
  const s = typeof img === 'string' ? { url: img } : img;
  if (isCivitaiVideo(s)) return civitaiThumbUrl(previewStill(s, width), width);
  return civitaiThumbUrl(s.url ?? '', width, { optimized: true });
}
