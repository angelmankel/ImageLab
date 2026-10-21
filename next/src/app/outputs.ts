/**
 * THE CONTRACT for "whose output is this" (fix list 2, items 9 + 15). Data tree:
 *
 *   Session ─┬─ Step ─┬─ Parameters (the step / the session's image + video params)
 *            │        └─ Outputs     (results: history entries by id, run results by url)
 *            └─ …
 *
 * Every job carries an owner { sessionId, stepId } from the moment it is queued (`recordJob`,
 * read back with `jobOwner(promptId)`), and every output gets one when it lands (`owners`).
 * Rules (pure, tested): `outputsLogic.ts`. Old outputs with no owner go to the Unsorted session.
 *
 * For other screens:
 *   useSessionImageResults() / useSessionVideoResults() / useSessionWorkflowResults()
 *       → the classic result lists, only THIS session's (pass a session id for another one)
 *   useOwnerCtx() + sessionOf(key, ctx) / ownedBy(list, sessionId, ctx)  → ownership in bulk
 *   sessionOfOutput(key), jobOwner(promptId), isJobOfSession(promptId, sessionId)
 *   ownerNow(source) — the open session + the step a new result of that kind goes to
 *   runAsOwner(owner, fn) — jobs that appear while `fn` runs belong to `owner` (Generate all)
 *   detachOutputs(keys) — out of every session (Clear all history), `restoreOwners` undoes it
 * Persisted under `imagelab.next.outputs.v1`.
 */
import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import type { ResultItem } from '@/lib/workspace';
import { useImageResults, useVideoResults, useWorkflowResults, type ImageResultItem } from '@/features/workspace/results';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useSessions } from './sessionsStore';
import { useSteps } from './stepsStore';
import { makeSession } from './sessionsLogic';
import { nanoid } from './ids';
import { useResultSteps } from '~/screens/image/resultSteps';
import { creditStep, type ResultSource } from '~/screens/image/historyLogic';
import { DETACHED, capRecord, isFresh, ownedBy, reassign, sessionOf, stepSessionMap, unsortedOf, type Owner, type OwnerCtx } from './outputsLogic';

export { DETACHED, sessionOf, ownedBy } from './outputsLogic';
export type { Owner, OwnerCtx } from './outputsLogic';

const MAX_OWNERS = 6000;
const MAX_JOBS = 600;
/** When this app started: a result made before it, that no job of ours claims, is an old one. */
const BOOT_AT = Date.now();

interface OutputsState {
  /** Result key → owner. */
  owners: Record<string, Owner>;
  /** ComfyUI prompt id → the session + step that queued it. */
  jobs: Record<string, Owner>;
  /** The old step tags were copied into `owners` once. */
  migrated: boolean;
  setOwners: (pairs: Array<[string, Owner]>) => void;
}

export const useOutputs = create<OutputsState>()(
  persist(
    (set) => ({
      owners: {},
      jobs: {},
      migrated: false,
      setOwners: (pairs) => set((s) => {
        if (!pairs.length) return s;
        const owners = { ...s.owners };
        for (const [k, o] of pairs) { delete owners[k]; owners[k] = o; }
        return { owners: capRecord(owners, MAX_OWNERS) };
      }),
    }),
    { name: 'imagelab.next.outputs.v1' },
  ),
);

// ---------------------------------------------------------------------------------------------
// Owners of steps / jobs

/** The session that holds `stepId` (the open session's live steps first), or null. */
export function sessionOfStep(stepId: string): string | null {
  const st = useSessions.getState();
  if (useSteps.getState().steps.some((s) => s.id === stepId)) return st.currentId || null;
  for (const s of Object.values(st.sessions)) if (s.steps.some((x) => x.id === stepId)) return s.id;
  return null;
}

/** The open session and the step a new result of `source` goes to (the active step when it makes that kind). */
export function ownerNow(source: ResultSource = 'image'): Owner {
  const { steps, activeId } = useSteps.getState();
  return { sessionId: useSessions.getState().currentId, stepId: creditStep(source, activeId, steps) ?? activeId };
}

/** The owner of a step (its session), or null when no session holds it. */
export function ownerOfStep(stepId: string): Owner | null {
  const sessionId = sessionOfStep(stepId);
  return sessionId ? { sessionId, stepId } : null;
}

export function recordJob(promptId: string, owner: Owner): void {
  useOutputs.setState((s) => ({ jobs: capRecord({ ...s.jobs, [promptId]: owner }, MAX_JOBS) }));
}

/** Who queued a job (image job id / run prompt id), or null (another client, or older than this). */
export function jobOwner(promptId: string | null | undefined): Owner | null {
  return promptId ? useOutputs.getState().jobs[promptId] ?? null : null;
}

/** A job counts for `sessionId` when that session queued it; a job with no known owner counts for every session. */
export function isJobOfSession(promptId: string | null | undefined, sessionId: string, jobs: Readonly<Record<string, Owner>> = useOutputs.getState().jobs): boolean {
  const o = promptId ? jobs[promptId] : undefined;
  return !o || o.sessionId === sessionId;
}

let pendingOwner: Owner | null = null;
/** Run `fn`; image jobs that appear meanwhile belong to `owner` (not to whatever is open when they land). */
export async function runAsOwner<T>(owner: Owner, fn: () => Promise<T> | T): Promise<T> {
  const before = pendingOwner;
  pendingOwner = owner;
  try { return await fn(); } finally { pendingOwner = before; }
}

// Image jobs: the owner is fixed the moment a job shows up in the main store.
let knownJobs = new Set<string>();
useStore.subscribe((st, prev) => {
  if (st.jobs === prev.jobs) return;
  const ids = new Set(st.jobs.map((j) => j.id));
  const jobs = useOutputs.getState().jobs;
  for (const id of ids) if (!knownJobs.has(id) && !jobs[id]) recordJob(id, pendingOwner ?? ownerNow('image'));
  knownJobs = ids;
});

// A step tag written by anyone (Generate all's `trackRun`, the credit hook) also fixes the owner.
useResultSteps.subscribe((s, prev) => {
  if (s.tags === prev.tags) return;
  const owners = useOutputs.getState().owners;
  const pairs: Array<[string, Owner]> = [];
  for (const [k, stepId] of Object.entries(s.tags)) {
    if (prev.tags[k] === stepId || owners[k]) continue;
    const o = ownerOfStep(stepId);
    if (o) pairs.push([k, o]);
  }
  if (pairs.length) useOutputs.getState().setOwners(pairs);
});

// ---------------------------------------------------------------------------------------------
// Ownership context + session-scoped result lists

const ctxOf = (owners: Record<string, Owner>, tags: Record<string, string>, sessions: ReturnType<typeof useSessions.getState>['sessions']): OwnerCtx =>
  ({ owners, tags, stepSession: stepSessionMap(sessions), unsortedId: unsortedOf(sessions) });

let lastCtx: { owners: object; tags: object; sessions: object; ctx: OwnerCtx } | null = null;
function memoCtx(owners: Record<string, Owner>, tags: Record<string, string>, sessions: ReturnType<typeof useSessions.getState>['sessions']): OwnerCtx {
  if (lastCtx && lastCtx.owners === owners && lastCtx.tags === tags && lastCtx.sessions === sessions) return lastCtx.ctx;
  const ctx = ctxOf(owners, tags, sessions);
  lastCtx = { owners, tags, sessions, ctx };
  return ctx;
}

/** Everything ownership needs, now. */
export function ownerCtxNow(): OwnerCtx {
  return memoCtx(useOutputs.getState().owners, useResultSteps.getState().tags, useSessions.getState().sessions);
}

/** Everything ownership needs (re-renders when owners, tags or sessions change). */
export function useOwnerCtx(): OwnerCtx {
  const owners = useOutputs((s) => s.owners);
  const tags = useResultSteps((s) => s.tags);
  const sessions = useSessions((s) => s.sessions);
  return memoCtx(owners, tags, sessions);
}

/** The session an output belongs to (null = none: cleared, or no Unsorted session). */
export function sessionOfOutput(key: string): string | null {
  return sessionOf(key, ownerCtxNow());
}

const useCurrentId = () => useSessions((s) => s.currentId);

function useScoped<T extends { key: string }>(list: T[], sessionId?: string): T[] {
  const cur = useCurrentId();
  const id = sessionId ?? cur;
  const ctx = useOwnerCtx();
  return useMemo(() => ownedBy(list, id, ctx), [list, id, ctx]);
}

/** This session's image results (history entries attached), newest first. */
export const useSessionImageResults = (sessionId?: string): ImageResultItem[] => useScoped(useImageResults(), sessionId);
/** This session's video results. */
export const useSessionVideoResults = (sessionId?: string): ResultItem[] => useScoped(useVideoResults(), sessionId);
/** This session's workflow-runner results (Workflow / Refine / Upscale / Remove BG steps). */
export const useSessionWorkflowResults = (sessionId?: string): ResultItem[] => useScoped(useWorkflowResults(), sessionId);

/** Is this output in the open session? */
export function useIsMine(key: string | null | undefined): boolean {
  const cur = useCurrentId();
  const ctx = useOwnerCtx();
  return !!key && sessionOf(key, ctx) === cur;
}

// ---------------------------------------------------------------------------------------------
// Moving outputs between sessions

/** Take outputs out of every session (they stay on the server and in the History page). Returns the old owners (for Undo). */
export function detachOutputs(keys: readonly string[]): Record<string, Owner | undefined> {
  const st = useOutputs.getState();
  const prev: Record<string, Owner | undefined> = {};
  for (const k of keys) prev[k] = st.owners[k];
  useOutputs.setState({ owners: reassign(st.owners, keys, DETACHED, useResultSteps.getState().tags) });
  return prev;
}

/** Undo of `detachOutputs`. */
export function restoreOwners(prev: Record<string, Owner | undefined>): void {
  useOutputs.setState((s) => {
    const owners = { ...s.owners };
    for (const [k, o] of Object.entries(prev)) { if (o) owners[k] = o; else delete owners[k]; }
    return { owners };
  });
}

/** Every output key of a session (image, video and workflow results) right now. */
export function sessionOutputKeysNow(sessionId: string): string[] {
  const ctx = ownerCtxNow();
  const keys = [
    ...useStore.getState().history.map((e) => e.id),
    ...useVideoRun.getState().results.map((r) => r.url),
    ...useWorkflowRun.getState().results.map((r) => r.url),
  ];
  return keys.filter((k) => sessionOf(k, ctx) === sessionId);
}

// ---------------------------------------------------------------------------------------------
// Crediting new results (mounted once in App)

/** Old outputs need a home: the session flagged `legacy`. Made (not opened) when there is none. */
function ensureUnsorted(): void {
  const st = useSessions.getState();
  if (unsortedOf(st.sessions)) return;
  const now = Date.now();
  const s = { ...makeSession(nanoid(), `step-${uid()}`, Math.min(now, ...Object.values(st.sessions).map((x) => x.createdAt)) - 1), name: 'Unsorted', legacy: true, updatedAt: 0 };
  useSessions.setState({ sessions: { ...st.sessions, [s.id]: s } });
}

/** The old result → step tags become owners once (so removing a step later does not orphan its outputs). */
function migrateTags(): void {
  const st = useOutputs.getState();
  if (st.migrated) return;
  const map = stepSessionMap(useSessions.getState().sessions);
  const pairs: Array<[string, Owner]> = [];
  for (const [k, stepId] of Object.entries(useResultSteps.getState().tags)) if (map[stepId] && !st.owners[k]) pairs.push([k, { sessionId: map[stepId], stepId }]);
  st.setOwners(pairs);
  useOutputs.setState({ migrated: true });
}

const promptOfRun = (url: string): string | undefined =>
  (useWorkflowRun.getState().results.find((r) => r.url === url) ?? useVideoRun.getState().results.find((r) => r.url === url))?.promptId;

/**
 * Every result that appears while the app runs gets its owner: the job that made it (its
 * prompt id), else — when it is really new (made by the ComfyUI editor, say) — the open step.
 * Results a `/history` reload brings in later stay Unsorted. Writes the step tag too.
 */
export function useCreditOutputs(): void {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const lists: Array<[ResultSource, ReadonlyArray<ResultItem & { entry?: { promptId?: string } }>]> = [['image', images], ['video', videos], ['workflow', runs]];
    if (!seen.current) {
      seen.current = new Set(lists.flatMap(([, l]) => l.map((r) => r.key)));
      migrateTags();
      if (seen.current.size) ensureUnsorted();
      return;
    }
    const { owners, jobs } = useOutputs.getState();
    const tags = useResultSteps.getState().tags;
    const pairs: Array<[string, Owner]> = [];
    let old = false;
    for (const [source, list] of lists) {
      for (const r of list) {
        if (seen.current.has(r.key)) continue;
        seen.current.add(r.key);
        if (owners[r.key] || tags[r.key]) continue;
        const promptId = r.entry?.promptId ?? (source === 'image' ? undefined : promptOfRun(r.key));
        const owner = (promptId && jobs[promptId]) || (isFresh(r.createdAt, BOOT_AT) ? ownerNow(source) : null);
        if (owner) pairs.push([r.key, owner]); else old = true;
      }
    }
    if (pairs.length) {
      useOutputs.getState().setOwners(pairs);
      useResultSteps.getState().tag(pairs.filter(([, o]) => o.stepId).map(([k, o]) => [k, o.stepId]));
    }
    if (old) ensureUnsorted();
  }, [images, videos, runs]);
}
