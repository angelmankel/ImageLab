/**
 * Drag-to-seek for the phone video player. No runtime imports: the tests load this file alone.
 *
 * A drag across the whole screen covers the whole clip, so a 5 s clip on a 390 px phone moves
 * about one frame per 5 px — fine enough to stop on a frame, quick enough to cross the clip.
 */

/** Past this many pixels a touch is a drag, not a tap. */
export const DRAG_SLOP = 8;

/** The time a drag of `delta` px (across a `span` px screen) from `start` lands on. */
export function scrubTime(start: number, delta: number, span: number, duration: number): number {
  if (!(duration > 0) || !(span > 0)) return start;
  return Math.min(duration, Math.max(0, start + (delta / span) * duration));
}

/**
 * The drag distance along the video's own horizontal axis. When the picture is turned 90°
 * clockwise with CSS (phones that refuse an orientation lock), its left-to-right runs down the
 * screen, so a drag down seeks forward.
 */
export function alongVideo(dx: number, dy: number, cssRotated: boolean): number {
  return cssRotated ? dy : dx;
}

/** "1.25 / 5.06 s" */
export function timeLabel(t: number, duration: number): string {
  return `${t.toFixed(2)} / ${(duration || 0).toFixed(2)} s`;
}
