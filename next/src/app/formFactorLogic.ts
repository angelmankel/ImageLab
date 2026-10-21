/**
 * Which shell a device gets (mobile pass, m-shell). Pure: no window, testable.
 *
 * The old rule was width < 768 only, so a phone turned sideways (800–950 CSS px wide) got the
 * DESKTOP shell. Now:
 *   - touch (primary pointer coarse): phone when the SCREEN's short side < 600 (every phone, both
 *     orientations, keyboard-proof because the screen does not shrink when the keyboard opens), or the
 *     window is under 768 wide (a small tablet in portrait / split screen, as before). Tablets ≥ 768
 *     wide keep the desktop shell.
 *   - mouse / pen (fine pointer): phone when the window is under 768 wide (unchanged).
 * Orientation: touch devices use the screen orientation (a keyboard shrinking the window never flips
 * portrait to landscape); mouse devices use the window's shape.
 */
export interface FormFactorInput {
  /** window.innerWidth / innerHeight (CSS px). */
  vw: number; vh: number;
  /** screen.width / height (CSS px; iOS does not swap them on rotation — only min/max are used). */
  sw: number; sh: number;
  /** primary pointer is coarse (finger). */
  coarse: boolean;
  /** screen.orientation.type when the browser has it ('portrait-primary' …), else null. */
  orientationType: string | null;
}

export interface FormFactor {
  /** the phone shell (dock, sheets, swipe). */
  phone: boolean;
  landscape: boolean;
  portrait: boolean;
  /** the window's short / long side, CSS px. */
  short: number;
  long: number;
  /** touch device (primary pointer coarse). */
  coarse: boolean;
}

/** Window narrower than this = phone shell on any device. */
export const PHONE_MAX_WIDTH = 767;
/** A touch screen whose short side is under this is a phone in both orientations. */
export const PHONE_SHORT_SIDE = 600;

export function computeFormFactor(i: FormFactorInput): FormFactor {
  const short = Math.min(i.vw, i.vh);
  const long = Math.max(i.vw, i.vh);
  const screenShort = Math.min(i.sw || i.vw, i.sh || i.vh);
  const narrow = i.vw <= PHONE_MAX_WIDTH;
  const phone = i.coarse ? (screenShort < PHONE_SHORT_SIDE || narrow) : narrow;
  let landscape: boolean;
  if (i.coarse && i.orientationType) landscape = i.orientationType.startsWith('landscape');
  else landscape = i.vw > i.vh;
  return { phone, landscape, portrait: !landscape, short, long, coarse: i.coarse };
}

export function sameFormFactor(a: FormFactor, b: FormFactor): boolean {
  return a.phone === b.phone && a.landscape === b.landscape && a.short === b.short && a.long === b.long && a.coarse === b.coarse;
}
