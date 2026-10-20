/**
 * Item 43: the checkerboard drawn behind a picture, so transparent parts (a Remove BG cut-out)
 * read as transparent on the stage, in compare and in the viewer. Only shows through where the
 * picture has alpha; an opaque picture covers it.
 */
import type { CSSProperties } from 'react';

export const CHECKER: CSSProperties = {
  backgroundColor: '#2a2a30',
  backgroundImage: 'conic-gradient(#3a3a42 25%, transparent 0 50%, #3a3a42 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
};

/** Is this file one that can carry alpha (PNG / WebP / GIF)? JPEGs never need the checkerboard. */
export const mayHaveAlpha = (name: string | null | undefined): boolean => !name || /\.(png|webp|gif|avif)(\?|$)/i.test(name);
