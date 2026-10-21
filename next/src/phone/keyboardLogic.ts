/**
 * On-screen keyboard arithmetic (mobile pass, m-shell). Pure; tests load it from source.
 */

/** Below this the visual viewport shrink is browser chrome (URL bar), not a keyboard. */
export const KEYBOARD_MIN_PX = 120;

/** The keyboard's height over the layout viewport, in window px (0 = closed). */
export function keyboardInset(layoutHeight: number, vvHeight: number, vvOffsetTop: number): number {
  const covered = Math.round(layoutHeight - vvHeight - vvOffsetTop);
  return covered >= KEYBOARD_MIN_PX ? covered : 0;
}

/** Margin kept between a focused field and the keyboard / top edge. */
export const FIELD_MARGIN = 12;

/**
 * How far to scroll so a focused field (its rect in window px) is fully visible inside the visible
 * band [top, bottom). Positive = scroll content up (the field moves up). 0 = already visible.
 * A field taller than the band shows its top.
 */
export function revealDelta(fieldTop: number, fieldBottom: number, bandTop: number, bandBottom: number): number {
  const top = bandTop + FIELD_MARGIN;
  const bottom = bandBottom - FIELD_MARGIN;
  if (fieldBottom - fieldTop > bottom - top) return fieldTop - top;
  if (fieldBottom > bottom) return fieldBottom - bottom;
  if (fieldTop < top) return fieldTop - top;
  return 0;
}
