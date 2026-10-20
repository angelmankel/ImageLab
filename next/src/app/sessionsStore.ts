/**
 * Sessions (items 20, 28, 36): every session with its whole steps stack, the open ones as tabs,
 * and which is current. `useSteps` (stepsStore.ts) stays THE store of the current session's
 * steps — its API is unchanged for everyone — and this store mirrors it:
 *
 *   useSteps ──subscribe──▶ sessions[currentId].{steps, activeId, name}      (every change)
 *   switchTo(id): snapshot the Image step's parameters (main store workflow + layers) and the
 *                 Video step's settings into the old session, load the new one's, then
 *                 useSteps.setState(the new session's steps).
 *
 * Persisted under `imagelab.next.sessions.v1`; the single-session save (`imagelab.next.steps.v1`)
 * becomes the first session once (`migrateLegacy`). Per-step stores keyed by step id (a Workflow
 * step's saved workflow, the Save / Revert snapshot) are copied along when a session is duplicated.
 * Session ids are nanoids (`ids.ts`).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import type { HistoryEntry, Layer, WorkflowState } from '@/lib/types';
import { useVideo } from '@/features/video/videoStore';
import { nanoid } from './ids';
import { useSteps } from './stepsStore';
import { useRoute } from './routeStore';
import { byRecent, closeTab as closeTabOf, displayName, duplicateSession, insertTabAfter, makeSession, migrateLegacy, moveTab as moveTabOf, slimForStorage, type ImageParams, type Session } from './sessionsLogic';

export { displayName, lastOutputOf, countOutputs, byRecent, byName, ago, UNTITLED } from './sessionsLogic';
export type { Session } from './sessionsLogic';

const EMPTY: Session[] = [];

interface SessionsState {
  sessions: Record<string, Session>;
  /** The tab strip, in order. Always holds `currentId`. */
  openIds: string[];
  currentId: string;
  /** A new blank session (no name), opened as a tab next to the current one and made current. Returns its id. */
  create: () => string;
  /** Open a session in a tab (if not open yet) and make it current. */
  open: (id: string) => void;
  /** Make an open session current (a tab click). */
  switchTo: (id: string) => void;
  /** Close a tab; the last one stays (returns false). The session itself is kept (Home lists it). */
  closeTab: (id: string) => boolean;
  moveTab: (from: number, to: number) => void;
  /** Delete a session for good. The current one → the next open tab, or a fresh session. */
  remove: (id: string) => void;
  /** A copy with fresh step ids, opened next to the current tab. Returns the new id. */
  duplicate: (id: string) => string;
  rename: (id: string, name: string) => void;
}

const LEGACY_KEY = 'imagelab.next.steps.v1';

function readLegacy(): { steps?: Session['steps']; activeId?: string; sessionName?: string } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) as { state?: Record<string, unknown> } : null;
    return (parsed?.state ?? null) as ReturnType<typeof readLegacy>;
  } catch { return null; }
}

/** The Image step's parameters as the main store holds them now. */
function imageParamsNow(): ImageParams {
  const st = useStore.getState();
  return { workflow: st.workflow, layers: st.layers };
}

function videoParamsNow(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(useVideo.getState()).filter(([, v]) => typeof v !== 'function'));
}

function loadImageParams(p: ImageParams | null | undefined): void {
  if (!p) return;
  const st = useStore.getState();
  st.setWorkflow(p.workflow as Partial<WorkflowState>);
  st.setPromptLayers(p.layers as Layer[]);
}

function loadVideoParams(p: Record<string, unknown> | null | undefined): void {
  if (p) useVideo.getState().set(p as Parameters<ReturnType<typeof useVideo.getState>['set']>[0]);
}

/** Per-step stores keyed by step id follow a duplicated session (loaded lazily: the comfy screen owns them). */
async function copyStepStores(map: Record<string, string>): Promise<void> {
  const [{ useWorkflowStore }, { copySnapshot }] = await Promise.all([import('~/screens/comfy/workflowStore'), import('~/screens/image/workflowSnapshots')]);
  const ws = useWorkflowStore.getState();
  for (const [from, to] of Object.entries(map)) {
    const ref = ws.byStep[from];
    if (ref) ws.setStepWorkflow(to, { ...ref });
    copySnapshot(from, to);
  }
}

/** Guards the mirror while this store writes `useSteps` itself. */
let loading = false;

function pushToSteps(s: Session): void {
  loading = true;
  try { useSteps.setState({ steps: s.steps, activeId: s.activeId, sessionName: s.name }); }
  finally { loading = false; }
}

export const useSessions = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      openIds: [],
      currentId: '',

      create: () => {
        const now = Date.now();
        const s = makeSession(nanoid(), `step-${uid()}`, now);
        // A new session starts from the current settings (model, size, sampler) with no input image: a new tab, not a reset.
        const cur = imageParamsNow();
        s.image = { workflow: { ...(cur.workflow as WorkflowState), inputImage: null }, layers: cur.layers };
        s.video = videoParamsNow();
        set((st) => ({ sessions: { ...st.sessions, [s.id]: s } }));
        get().open(s.id);
        return s.id;
      },

      open: (id) => {
        const st = get();
        if (!st.sessions[id]) return;
        if (!st.openIds.includes(id)) set({ openIds: insertTabAfter(st.openIds, st.currentId, id) });
        get().switchTo(id);
      },

      switchTo: (id) => {
        const st = get();
        const next = st.sessions[id];
        if (!next || id === st.currentId) return;
        const prev = st.sessions[st.currentId];
        const sessions = { ...st.sessions };
        if (prev) sessions[prev.id] = { ...prev, image: imageParamsNow(), video: videoParamsNow() };
        sessions[id] = { ...next, updatedAt: Date.now() };
        set({ sessions, currentId: id, openIds: st.openIds.includes(id) ? st.openIds : [...st.openIds, id] });
        loadImageParams(next.image);
        loadVideoParams(next.video);
        pushToSteps(next);
      },

      closeTab: (id) => {
        const st = get();
        const r = closeTabOf(st.openIds, st.currentId, id);
        if (!r) return false;
        if (r.currentId !== st.currentId) get().switchTo(r.currentId);
        set({ openIds: r.openIds });
        return true;
      },

      moveTab: (from, to) => set((st) => ({ openIds: moveTabOf(st.openIds, from, to) })),

      remove: (id) => {
        const st = get();
        if (!st.sessions[id]) return;
        if (id === st.currentId) {
          const other = st.openIds.find((x) => x !== id) ?? byRecent(Object.values(st.sessions).filter((s) => s.id !== id))[0]?.id;
          if (other) get().open(other);
          else get().create();
        }
        set((s) => {
          const sessions = { ...s.sessions };
          delete sessions[id];
          return { sessions, openIds: s.openIds.filter((x) => x !== id) };
        });
      },

      duplicate: (id) => {
        const st = get();
        const src = st.sessions[id];
        if (!src) return '';
        const live = id === st.currentId ? { ...src, image: imageParamsNow(), video: videoParamsNow() } : src;
        const { session, map } = duplicateSession(live, nanoid(), () => `step-${uid()}`, Date.now());
        set((s) => ({ sessions: { ...s.sessions, [session.id]: session } }));
        void copyStepStores(map);
        get().open(session.id);
        return session.id;
      },

      rename: (id, name) => {
        const st = get();
        if (!st.sessions[id]) return;
        if (id === st.currentId) useSteps.getState().renameSession(name);
        else set((s) => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], name: name.trim() } } }));
      },
    }),
    {
      name: 'imagelab.next.sessions.v1',
      // A full localStorage must never break a click: a failed write is dropped (the next change tries again).
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* quota: keep going in memory */ } },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
      })),
      partialize: (s) => ({
        sessions: Object.fromEntries(Object.entries(s.sessions).map(([id, x]) => [id, x.image ? { ...x, image: slimForStorage(x.image) } : x])),
        openIds: s.openIds,
        currentId: s.currentId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SessionsState>;
        let sessions = p.sessions ?? {};
        // First run with sessions: the single-session save becomes session 1.
        if (!Object.keys(sessions).length) {
          const first = migrateLegacy(readLegacy(), nanoid(), 'step-image', Date.now());
          sessions = { [first.id]: first };
        }
        const ids = Object.keys(sessions);
        let openIds = (p.openIds ?? []).filter((id) => sessions[id]);
        let currentId = p.currentId && sessions[p.currentId] ? p.currentId : openIds[0] ?? byRecent(Object.values(sessions))[0].id;
        if (!openIds.includes(currentId)) openIds = [currentId, ...openIds];
        if (!ids.length) openIds = [];
        return { ...current, sessions, openIds, currentId };
      },
    },
  ),
);

/** Mirror: whatever the steps store does to the current session's steps lands in that session. */
useSteps.subscribe((s, prev) => {
  if (loading) return;
  if (s.steps === prev.steps && s.activeId === prev.activeId && s.sessionName === prev.sessionName) return;
  const st = useSessions.getState();
  const cur = st.sessions[st.currentId];
  if (!cur) return;
  const changed = s.steps !== prev.steps;
  useSessions.setState({ sessions: { ...st.sessions, [cur.id]: { ...cur, steps: s.steps, activeId: s.activeId, name: s.sessionName, updatedAt: changed ? Date.now() : cur.updatedAt } } });
});

// Boot: the current session's steps go into the steps store (the single-session save was already
// read by `useSteps` itself, so for a migrated session this is the same data).
{
  const st = useSessions.getState();
  const cur = st.sessions[st.currentId];
  // The current session's Image / Video parameters are what the main stores hold (they persist on their own): nothing to load.
  if (cur) pushToSteps(cur);
}

/** The current session (never undefined once booted). */
export const useCurrentSession = (): Session => useSessions((s) => s.sessions[s.currentId]) ?? useSessions.getState().sessions[useSessions.getState().currentId];

/** The open tabs as sessions, in tab order (memo-free: a new array only when the store's slices change). */
export function useOpenSessions(): Session[] {
  const openIds = useSessions((s) => s.openIds);
  const sessions = useSessions((s) => s.sessions);
  return openIds.length ? openIds.flatMap((id) => (sessions[id] ? [sessions[id]] : [])) : EMPTY;
}

/** Every session, the one worked on last first (Home). */
export function useAllSessions(): Session[] {
  const sessions = useSessions((s) => s.sessions);
  return byRecent(Object.values(sessions));
}

/** The current session's name for titles; `displayName` adds the placeholder. */
export const useSessionName = (): string => useSteps((s) => s.sessionName);

export interface ImageLike {
  /** The result's key (history id / run url, what the step tags use). */
  key?: string;
  /** The history entry id when it is an image result (the drag payload's `entryId`). */
  entryId?: string;
  url: string;
  name?: string;
  entry?: HistoryEntry | null;
}

/**
 * Item 28 / 30 / 45: a new session that is a duplicate of the whole steps stack that made this
 * image (every step, its prompt, models, parameters, inputs), so it can recreate it. The owner
 * session is the one whose step the result is tagged with (else the current one); when the
 * entry carries its generation snapshot (workflow + prompt layers), the copy's Image step gets
 * exactly that, seed fixed. Opens the new session on its step and returns its id.
 */
export function newSessionFromImage(image: ImageLike | HistoryEntry): string {
  const like = 'filename' in image ? null : image;
  const id = like ? like.entryId ?? like.key : (image as HistoryEntry).id;
  const entry: HistoryEntry | null = !like ? (image as HistoryEntry) : like.entry ?? (id ? useStore.getState().history.find((h) => h.id === id) ?? null : null);
  const key = like?.key ?? entry?.id ?? null;
  const st = useSessions.getState();
  // Find who made it: the step tag → its session. Loaded lazily: the tags belong to the image screen.
  let ownerId = st.currentId;
  let stepId: string | null = null;
  try {
    const raw = localStorage.getItem('imagelab.next.resultSteps.v1');
    const tags = raw ? (JSON.parse(raw) as { state?: { tags?: Record<string, string> } }).state?.tags ?? {} : {};
    stepId = key ? tags[key] ?? null : null;
    if (stepId) for (const s of Object.values(st.sessions)) if (s.steps.some((x) => x.id === stepId)) { ownerId = s.id; break; }
  } catch { /* no tags: the current session is the owner */ }
  const src = st.sessions[ownerId] ?? st.sessions[st.currentId];
  const live = src.id === st.currentId ? { ...src, image: imageParamsNow(), video: videoParamsNow() } : src;
  const { session, map } = duplicateSession(live, nanoid(), () => `step-${uid()}`, Date.now());
  session.name = '';
  if (entry?.workflow) {
    const layers: Layer[] = entry.layers?.length ? entry.layers.map((l) => ({ ...l, id: uid() })) : [
      ...(entry.positive ? [{ id: uid(), on: true, kind: 'positive' as const, tag: 'Recalled', text: entry.positive, weight: 1 }] : []),
      ...(entry.negative ? [{ id: uid(), on: true, kind: 'negative' as const, tag: 'Recalled', text: entry.negative, weight: 1 }] : []),
    ];
    session.image = { workflow: { ...entry.workflow, seed: entry.seed, randomizeSeed: false }, layers: layers.length ? layers : (live.image?.layers ?? []) };
  }
  if (stepId && map[stepId]) session.activeId = map[stepId];
  useSessions.setState((s) => ({ sessions: { ...s.sessions, [session.id]: session } }));
  void copyStepStores(map);
  useSessions.getState().open(session.id);
  useRoute.getState().go('step');
  return session.id;
}

/** The title a tab / tile shows. */
export const sessionLabel = (s: Pick<Session, 'name'>): string => displayName(s.name);
