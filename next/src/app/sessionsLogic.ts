/**
 * Pure rules for sessions (fix list 20 / 28 / 36): a session = a steps stack with its own
 * parameters; several are open as tabs at once; Home lists them all. No React, no stores: tested
 * in tests/sessions.test.cjs. The store (`sessionsStore.ts`) applies these.
 */
import type { Step } from './stepsLogic';

/** The Image step's parameters (main store `workflow` + prompt `layers`), kept opaque here. */
export interface ImageParams { workflow: unknown; layers: unknown[] }

/** A session as the store keeps it. `name` may be '' (an unnamed session shows the placeholder). */
export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  steps: Step[];
  activeId: string;
  /** The Image step's parameters as they were when this session was last left (null = never left: the live stores hold them). */
  image?: ImageParams | null;
  /** The Video step's settings, same rule. */
  video?: Record<string, unknown> | null;
  /** The session migrated from the single-session save: it owns the results made before step tags existed. */
  legacy?: boolean;
}

export const UNTITLED = 'Untitled session';

/** What a tab / tile / header shows: the name, or the placeholder. */
export const displayName = (name: string | null | undefined): string => (name ?? '').trim() || UNTITLED;

/** A blank session: one Image step, no name. */
export function makeSession(id: string, stepId: string, now: number): Session {
  return { id, name: '', createdAt: now, updatedAt: now, steps: [{ id: stepId, kind: 'image', name: 'Image', edited: false, chained: false }], activeId: stepId };
}

/** Names the app gave by itself before sessions existed: they read as "not named yet". */
const OLD_DEFAULTS = new Set(['portrait session', 'session']);

/** The single-session save (`imagelab.next.steps.v1`) becomes session 1. */
export function migrateLegacy(
  legacy: { steps?: Step[]; activeId?: string; sessionName?: string } | null | undefined,
  id: string, firstStepId: string, now: number,
): Session {
  const base = makeSession(id, firstStepId, now);
  const raw = legacy?.steps?.length ? legacy.steps : null;
  const steps = !raw ? base.steps : raw[0].kind === 'image' ? raw : [base.steps[0], ...raw.filter((s) => s.kind !== 'image')];
  const activeId = steps.some((s) => s.id === legacy?.activeId) ? legacy!.activeId! : steps[0].id;
  const nm = (legacy?.sessionName ?? '').trim();
  return { ...base, steps, activeId, name: OLD_DEFAULTS.has(nm.toLowerCase()) ? '' : nm, legacy: true };
}

const clone = <T>(v: T): T => (v == null ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * A copy of a session: the same steps (inputs, picks, names) with fresh ids from `makeStepId`,
 * the same parameters, and `map` old step id → new so per-step stores can copy too.
 */
export function duplicateSession(src: Session, id: string, makeStepId: () => string, now: number): { session: Session; map: Record<string, string> } {
  const map: Record<string, string> = {};
  for (const s of src.steps) map[s.id] = makeStepId();
  const steps = src.steps.map((s) => ({ ...clone(s), id: map[s.id] }));
  const session: Session = {
    id, name: src.name, createdAt: now, updatedAt: now, steps,
    activeId: map[src.activeId] ?? steps[0].id,
    image: src.image ? { workflow: clone(src.image.workflow), layers: clone(src.image.layers) } : src.image ?? null,
    video: clone(src.video ?? null),
    legacy: false,
  };
  return { session, map };
}

/** Move the tab at `from` to `to` (a drag). Out-of-range `from` leaves the list as it is. */
export function moveTab(open: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= open.length) return [...open];
  const next = [...open];
  const [id] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

/** Open `id` as a tab right after `afterId` (at the end when `afterId` is not open). Already open = unchanged. */
export function insertTabAfter(open: readonly string[], afterId: string, id: string): string[] {
  if (open.includes(id)) return [...open];
  const i = open.indexOf(afterId);
  if (i < 0) return [...open, id];
  return [...open.slice(0, i + 1), id, ...open.slice(i + 1)];
}

/**
 * Close a tab. The last tab never closes (null), nor an unknown one. Closing the current tab
 * makes its right-hand neighbour current, or the left one at the end, as browsers do.
 */
export function closeTab(open: readonly string[], currentId: string, id: string): { openIds: string[]; currentId: string } | null {
  const i = open.indexOf(id);
  if (i < 0 || open.length <= 1) return null;
  const openIds = open.filter((x) => x !== id);
  if (currentId !== id) return { openIds, currentId };
  return { openIds, currentId: openIds[Math.min(i, openIds.length - 1)] };
}

/** The session worked on last first. */
export function byRecent<S extends { updatedAt: number; createdAt?: number }>(sessions: readonly S[]): S[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt || (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** By name (unnamed last), then recent. */
export function byName<S extends { name: string; updatedAt: number }>(sessions: readonly S[]): S[] {
  return [...sessions].sort((a, b) => {
    const an = a.name.trim(), bn = b.name.trim();
    if (!an !== !bn) return an ? -1 : 1;
    return an.localeCompare(bn, undefined, { sensitivity: 'base' }) || b.updatedAt - a.updatedAt;
  });
}

export interface ResultLite { key: string; url: string; createdAt: number; kind?: string }

/**
 * The newest result one of the session's steps made (result → step tags from `resultSteps.ts`),
 * or null. Results with no tag (made before tags existed) belong to the legacy session.
 */
export function lastOutputOf<R extends ResultLite>(session: Pick<Session, 'steps' | 'legacy'>, tags: Readonly<Record<string, string>>, results: readonly R[]): R | null {
  const ids = new Set(session.steps.map((s) => s.id));
  let best: R | null = null;
  for (const r of results) {
    const tag = tags[r.key];
    const mine = tag ? ids.has(tag) : !!session.legacy;
    if (mine && (!best || r.createdAt > best.createdAt)) best = r;
  }
  return best;
}

/** How many results each session made (same ownership rule as `lastOutputOf`). */
export function countOutputs(session: Pick<Session, 'steps' | 'legacy'>, tags: Readonly<Record<string, string>>, results: readonly ResultLite[]): number {
  const ids = new Set(session.steps.map((s) => s.id));
  let n = 0;
  for (const r of results) {
    const tag = tags[r.key];
    if (tag ? ids.has(tag) : !!session.legacy) n++;
  }
  return n;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", "2 w ago", "4 mo ago", "1 y ago". */
export function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  if (d < 30) return `${Math.round(d / 7)} w ago`;
  if (d < 365) return `${Math.round(d / 30)} mo ago`;
  return `${Math.round(d / 365)} y ago`;
}

/** Every step id across every session (per-step stores must not forget steps of a session that is not open). */
export function allStepIds(sessions: Readonly<Record<string, Pick<Session, 'steps'>>>): Set<string> {
  const out = new Set<string>();
  for (const s of Object.values(sessions)) for (const st of s.steps) out.add(st.id);
  return out;
}

/** Drop big inline pictures (a data: URL input image) from what gets persisted; localStorage is ~5 MB for everything. */
export function slimForStorage(image: ImageParams | null | undefined, maxChars = 150_000): ImageParams | null | undefined {
  const wf = image?.workflow as { inputImage?: { dataUrl?: string } | null } | undefined;
  if (!image || !wf?.inputImage?.dataUrl || wf.inputImage.dataUrl.length <= maxChars) return image;
  return { ...image, workflow: { ...wf, inputImage: null } };
}
