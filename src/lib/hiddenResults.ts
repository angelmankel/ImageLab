/**
 * Run results the user deleted (video / workflow). Their files stay on the server and come back
 * with every `/history` reload, so each run store (`comfyRunner.ts`) keeps the deleted urls —
 * persisted, capped, oldest dropped first — and leaves them out of whatever it loads or merges.
 * Imports nothing; pure + tested in `tests/hidden-results.test.cjs`.
 */

/** How many deleted urls a store remembers; older ones fall off (their runs are long gone from `/history` by then). */
export const HIDDEN_MAX = 500;

/** The list with `url` added as the newest, capped at `max`. */
export function hideUrl(list: readonly string[], url: string, max = HIDDEN_MAX): string[] {
  const next = [...list.filter(u => u !== url), url];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The list without `url` (Undo). */
export function unhideUrl(list: readonly string[], url: string): string[] {
  return list.filter(u => u !== url);
}

/** `results` minus the hidden ones; the same array when nothing is hidden in it. */
export function withoutHidden<T extends { url: string }>(results: T[], hidden: readonly string[]): T[] {
  if (!hidden.length) return results;
  const set = new Set(hidden);
  return results.some(r => set.has(r.url)) ? results.filter(r => !set.has(r.url)) : results;
}

/** `item` back at `index` (clamped), unless a result with its url is already there. */
export function insertResult<T extends { url: string }>(list: T[], index: number, item: T): T[] {
  if (list.some(r => r.url === item.url)) return list;
  const i = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/** A saved list back from storage: strings only, capped; anything else is an empty list. */
export function parseHidden(raw: string | null | undefined, max = HIDDEN_MAX): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out = v.filter((u): u is string => typeof u === 'string');
    return out.length > max ? out.slice(out.length - max) : out;
  } catch {
    return [];
  }
}
