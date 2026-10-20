/**
 * Library (rule 12): pure rules for grid video autoplay. Which zone a tile is in (from its
 * IntersectionObserver entry), whether autoplay is allowed at all, how many may play at once, and
 * which visible tiles win (nearest the viewport centre). No DOM here; tests load this file.
 */

/** off = outside root + margin (paused, decoder released after a while); near = src kept, paused; visible = may play. */
export type Zone = 'off' | 'near' | 'visible';

export const ROOT_MARGIN = '100px 0px';
export const VISIBLE_RATIO = 0.25;
/** How long a tile stays off screen before its decoder is released (scrolling back and forth keeps frames). */
export const RELEASE_MS = 3000;

export function zoneFor(isIntersecting: boolean, ratio: number, visibleRatio = VISIBLE_RATIO): Zone {
  if (!isIntersecting) return 'off';
  return ratio >= visibleRatio ? 'visible' : 'near';
}

/** Concurrent playing videos: 3 on the phone, 6 on desktop. */
export function playCap(isPhone: boolean): number {
  return isPhone ? 3 : 6;
}

/** No autoplay for reduced motion, the Save-Data hint, or while something covers the grid. */
export function autoplayAllowed(o: { reducedMotion: boolean; saveData: boolean; paused?: boolean }): boolean {
  return !o.reducedMotion && !o.saveData && !o.paused;
}

export interface Box { key: string; top: number; height: number }

/** The `cap` candidates whose centres are nearest the view's centre; ties keep grid order. */
export function pickPlaying(tiles: readonly Box[], view: { top: number; height: number }, cap: number): string[] {
  if (cap <= 0) return [];
  const mid = view.top + view.height / 2;
  return tiles
    .map((t, i) => ({ key: t.key, i, d: Math.abs(t.top + t.height / 2 - mid) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, cap)
    .map((t) => t.key);
}
