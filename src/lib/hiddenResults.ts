/**
 * Run results the user deleted (video / workflow). Their files stay on the server and come back
 * with every `/history` reload, so each run store (`comfyRunner.ts`) keeps the deleted urls —
 * persisted, capped, oldest dropped first — and leaves them out of whatever it loads or merges.
 * Imports nothing; pure + tested in `tests/hidden-results.test.cjs`.
 */

/**
 * What a hidden url stands for: a ComfyUI `/view?filename=…&subfolder=…&type=…` url is the file
 * (`filename|subfolder|type`), whatever host or path prefix it was built with — the same file can
 * come back under another server address or proxy path, and must stay hidden. Anything else: the url.
 */
export function resultFileKey(url: string): string {
  const q = url.indexOf('?');
  if (q < 0 || !/\/view$/.test(url.slice(0, q))) return url;
  const params: Record<string, string> = {};
  for (const part of url.slice(q + 1).split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const dec = (v: string) => { try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return v; } };
    params[dec(part.slice(0, eq))] = dec(part.slice(eq + 1));
  }
  if (!params.filename) return url;
  return `file:${params.filename}|${params.subfolder ?? ''}|${params.type || 'output'}`;
}

/** How many deleted urls a store remembers; older ones fall off (their runs are long gone from `/history` by then). */
export const HIDDEN_MAX = 500;

/** The list with `url` added as the newest, capped at `max`. */
export function hideUrl(list: readonly string[], url: string, max = HIDDEN_MAX): string[] {
  const key = resultFileKey(url);
  const next = [...list.filter(u => resultFileKey(u) !== key), url];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The list without `url` (Undo). */
export function unhideUrl(list: readonly string[], url: string): string[] {
  const key = resultFileKey(url);
  return list.filter(u => resultFileKey(u) !== key);
}

/** `results` minus the hidden ones; the same array when nothing is hidden in it. */
export function withoutHidden<T extends { url: string }>(results: T[], hidden: readonly string[]): T[] {
  if (!hidden.length) return results;
  const set = new Set(hidden.map(resultFileKey));
  return results.some(r => set.has(resultFileKey(r.url))) ? results.filter(r => !set.has(resultFileKey(r.url))) : results;
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
