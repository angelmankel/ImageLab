/**
 * Fix list 2, item 9: the data tree Session → Steps → (Parameters + Outputs), the pure part.
 * Every output (a result key: history entry id, or a run result's url) belongs to ONE session and
 * one step of it. No React, no stores: tested in tests/outputs.test.cjs. The store + hooks are
 * `outputs.ts` (the contract other screens import).
 *
 * Who owns an output, first match wins:
 *   1. its owner record (`owners[key]`, written when it was made / tagged). sessionId '' = taken
 *      out of every session ("Clear all history": the file stays on the server and in the History page);
 *   2. its step tag (`tags[key]`, result → step) when that step is in a session;
 *   3. otherwise (made before scoping, by another client, or its step is gone): the Unsorted
 *      session (the session migrated from the single-session save, `legacy: true`).
 */

export interface Owner { sessionId: string; stepId: string }

/** `owners[key].sessionId` for an output taken out of every session. */
export const DETACHED = '';

export interface OwnerCtx {
  owners: Readonly<Record<string, Owner>>;
  /** Result key → step id (`resultSteps.ts`). */
  tags: Readonly<Record<string, string>>;
  /** Step id → the session that holds it. */
  stepSession: Readonly<Record<string, string>>;
  /** Where outputs with no owner go; null = nowhere (History page only). */
  unsortedId: string | null;
}

/** Step id → session id over every session. */
export function stepSessionMap(sessions: Readonly<Record<string, { id: string; steps: ReadonlyArray<{ id: string }> }>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of Object.values(sessions)) for (const st of s.steps) out[st.id] = s.id;
  return out;
}

/** The session an output belongs to, or null (detached / nobody). */
export function sessionOf(key: string, ctx: OwnerCtx): string | null {
  const o = ctx.owners[key];
  if (o) return o.sessionId || null;
  const tag = ctx.tags[key];
  if (tag && ctx.stepSession[tag]) return ctx.stepSession[tag];
  return ctx.unsortedId;
}

/** The outputs of one session, in the list's order (the same array when all of them are). */
export function ownedBy<T extends { key: string }>(list: readonly T[], sessionId: string, ctx: OwnerCtx): T[] {
  const out = list.filter((r) => sessionOf(r.key, ctx) === sessionId);
  return out.length === list.length ? (list as T[]) : out;
}

/** The Unsorted session: the oldest one flagged `legacy`, else null. */
export function unsortedOf(sessions: Readonly<Record<string, { id: string; legacy?: boolean; createdAt: number }>>): string | null {
  let best: { id: string; createdAt: number } | null = null;
  for (const s of Object.values(sessions)) if (s.legacy && (!best || s.createdAt < best.createdAt)) best = s;
  return best?.id ?? null;
}

/** A record trimmed to its newest `max` keys (insertion order = age). */
export function capRecord<V>(rec: Record<string, V>, max: number): Record<string, V> {
  const keys = Object.keys(rec);
  if (keys.length <= max) return rec;
  const out: Record<string, V> = {};
  for (const k of keys.slice(keys.length - max)) out[k] = rec[k];
  return out;
}

/**
 * A result that showed up while the app runs and that no job of ours claims: is it new (made
 * now, e.g. by the ComfyUI editor: credit the open step) or an old one a `/history` reload brought
 * in (leave it to Unsorted)? New = made after the app started, give or take `graceMs`.
 */
export function isFresh(createdAt: number, bootAt: number, graceMs = 120_000): boolean {
  return createdAt > 0 && createdAt >= bootAt - graceMs;
}

/** Owner records for `keys`, all moved to `sessionId` (DETACHED = out of every session). */
export function reassign(owners: Readonly<Record<string, Owner>>, keys: readonly string[], sessionId: string, tags: Readonly<Record<string, string>> = {}): Record<string, Owner> {
  const out = { ...owners };
  for (const k of keys) out[k] = { sessionId, stepId: owners[k]?.stepId ?? tags[k] ?? '' };
  return out;
}
