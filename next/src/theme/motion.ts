/**
 * Item 35: motion for code. CSS: `dur(.2)` = a transition length that follows Settings → Themes →
 * Motion (Full / Subtle / Off, speed) and the system's reduced-motion. JS animations (WAAPI,
 * springs): `motionScale()` = the factor to multiply a duration by (0 = do not animate). Item 3:
 * the viewer's open / close / seek and a new image's arrival never animate, whatever this says.
 */
export const dur = (seconds: number): string => `calc(${seconds}s * var(--il-motion, 1) * var(--il-dur, 1))`;

export function motionScale(): number {
  if (typeof window === 'undefined') return 1;
  const css = getComputedStyle(document.documentElement);
  const m = parseFloat(css.getPropertyValue('--il-motion'));
  const d = parseFloat(css.getPropertyValue('--il-dur'));
  return (Number.isFinite(m) ? m : 1) * (Number.isFinite(d) ? d : 1);
}
