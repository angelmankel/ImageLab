/**
 * The desktop workspace's layout state, as plain data: which settings cards are folded per mode,
 * how Alt+N and the arrow keys pick a card or a result, and the stored width of the results strip.
 * Every function returns a new value and never mutates. Imports nothing, so the tests load it from
 * source.
 */

/** The old Video view kept its folded cards here; the workspace reads it once as video's start. */
export const OLD_VIDEO_FOLDED_KEY = 'imagelab.video.folded.v1';

/** Cards that start folded when nothing is stored: the expert files are picked for you. */
export const DEFAULT_FOLDED: Readonly<Record<string, readonly string[]>> = {
  image: [],
  video: ['models'],
  workflow: [],
};

/** Keep only known ids, in a stable order, without repeats. */
export function cleanFolded(raw: unknown, valid: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) if (typeof id === 'string' && valid.includes(id) && !out.includes(id)) out.push(id);
  return out;
}

export function toggleFolded(folded: readonly string[], id: string): string[] {
  return folded.includes(id) ? folded.filter(x => x !== id) : [...folded, id];
}

/** Open the card (so a jump to it never lands on a folded header). */
export function unfold(folded: readonly string[], id: string): string[] {
  return folded.includes(id) ? folded.filter(x => x !== id) : [...folded];
}

/** Alt+1…9: the Nth card on screen, or null past the end. */
export function nthSection<T>(shown: readonly T[], digit: number): T | null {
  return digit >= 1 && digit <= shown.length ? shown[digit - 1] : null;
}

/**
 * ←/→ through a newest-first list: left goes older (+1), right goes newer (-1), clamped at the
 * ends. A negative index (nothing picked) steps from the newest.
 */
export function stepResult(index: number, length: number, dir: 1 | -1): number {
  if (length <= 0) return -1;
  const from = index < 0 ? 0 : Math.min(index, length - 1);
  return Math.max(0, Math.min(length - 1, from + dir));
}

/** The strip under the hero: 56–160px thumbnails, 96 when nothing is stored. */
export const STRIP_LIMITS = { min: 56, max: 160, default: 96 } as const;

export function clampStrip(size: unknown): number {
  const n = typeof size === 'number' && Number.isFinite(size) ? size : STRIP_LIMITS.default;
  return Math.round(Math.max(STRIP_LIMITS.min, Math.min(STRIP_LIMITS.max, n)));
}

/** Two of the three columns may fold; the centre always keeps at least this much of the window. */
export const MIN_CENTER_SHARE = 0.3;
