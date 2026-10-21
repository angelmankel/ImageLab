/**
 * A ComfyUI run that outlives the view that started it.
 *
 * Video and Workflow each get one of these (`features/video/videoRun.ts`, `features/studio/
 * studioRun.ts`). The state lives in a zustand store, not in a component, so switching to Image
 * while a video renders keeps the run tracked, its progress visible in the job tray, and its
 * result landing in the strip when it is done. The socket is the shared bus (one per host); this
 * subscribes while a view is attached or a run is in flight, and lets go when neither is true.
 *
 * Several runs at once (next UI, item 46): every `run` queues its graph even while another is in
 * flight; `jobs` lists ours until each finishes, `cancel(promptId)` stops one. `busy`, `progress`,
 * `currentNode` and `preview` follow whichever of ours is executing.
 *
 * Delete: `removeResult(url)` drops a result and remembers its url (`hiddenResults.ts`, persisted
 * per store under `hideKey`), so the next `/history` reload does not bring it back; the file stays
 * on the server. `restoreResult` is the Undo.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { subscribeComfy, type ComfyEvent } from './comfyBus';
import { comfyHttpFor, deleteQueuedPrompt, queueGraph, viewUrl } from './comfy';
import { playCompleteSound, playSubmitSound } from './sounds';
import { isImageJob } from './promptOwners';
import type { ApiGraph } from './workflowGraph';
import { hideUrl, insertResult, parseHidden, unhideUrl, withoutHidden } from './hiddenResults';

export interface RunResult {
  url: string;
  filename: string;
  promptId: string;
  createdAt: number;
  /** Wall time from queueing the run to this result, in ms. */
  durationMs?: number;
}

/** Which saved files are this run's results. */
export type KeepResult = (img: { filename: string; subfolder?: string }) => boolean;

export interface FinishedRun { graph: ApiGraph; nodeMs: Record<string, number>; totalMs: number }

/** What a run is made of: how to make the graph, and which saved files are its results. */
export interface RunSource {
  build: () => Promise<{ graph: ApiGraph; warnings?: string[] } | { error: string }>;
  keep?: KeepResult;
  /** A run of ours finished: the graph it ran, and how long each node took (cached nodes: none). */
  onFinished?: (run: FinishedRun) => void;
}

/** One run of ours that has not finished yet. */
export interface RunJob {
  promptId: string;
  queuedAt: number;
  running: boolean;
  /** 0..1 through the running node's steps, null when unknown or waiting. */
  progress: number | null;
}

export interface RunState {
  host: string | null;
  busy: boolean;
  status: string | null;
  error: string | null;
  results: RunResult[];
  /** Newest result, or null before anything has finished. */
  latest: RunResult | null;
  /** 0..1 through the current node's steps, or null when nothing is sampling. */
  progress: number | null;
  /** The node ComfyUI is executing, as the workflow names it. */
  currentNode: string | null;
  /** Object URL of the latest live preview frame, or null. */
  preview: string | null;
  connected: boolean;
  /** Jobs waiting on this server, including other clients'. */
  queueRemaining: number;
  /** When the current run was queued, for the tray's timer. */
  startedAt: number | null;
  /** Every run of ours still to finish, oldest first (several may wait: each Generate press queues one). */
  jobs: RunJob[];

  /** Point the runner at a host (the view's server). Results reload from its `/history`. */
  setHost: (host: string | null) => void;
  /** A view is on screen: hold the socket open for it. Returns the release. */
  attach: () => () => void;
  /** Queue a run. A run already in flight does not block it: ComfyUI queues the next one. */
  run: (source: RunSource) => Promise<void>;
  /** Cancel one run (running = interrupt, waiting = taken off the server's queue), or all of ours. */
  cancel: (promptId?: string) => Promise<void>;
  clearError: () => void;
  /** Delete a result from the list (the file stays on the server); it stays gone across reloads. */
  removeResult: (url: string) => void;
  /** Undo of `removeResult`: un-hide `result` and put it back at `index`. */
  restoreResult: (result: RunResult, index: number) => void;
  /** Keep these files out of the list for good (and drop them now): an image deleted from the image
   *  history must not come back as a run result from the next `/history` reload. */
  hideUrls: (urls: readonly string[]) => void;
  /** Undo of `hideUrls` (nothing is put back in the list: a reload or the image history has it). */
  unhideUrls: (urls: readonly string[]) => void;
}

export type RunStore = UseBoundStore<StoreApi<RunState>>;

const MAX_RESULTS = 300;
/** Safety net only: the socket drives everything, but a missed `execution_success` should not hang forever. */
const WATCHDOG_MS = 8000;
const keepAll: KeepResult = () => true;

type HistoryImage = { filename: string; subfolder?: string; type?: string };
type HistoryRecord = {
  prompt?: [number, string, ...unknown[]];
  outputs?: Record<string, { images?: HistoryImage[] }>;
  status?: { completed?: boolean; messages?: Array<[string, { timestamp?: number }]> };
};

/** When a recorded run happened (ms): its last status message's timestamp. `prompt[0]` is only the queue number. */
const recordTime = (r: HistoryRecord): number => {
  const msgs = r.status?.messages ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) { const t = msgs[i]?.[1]?.timestamp; if (typeof t === 'number') return t; }
  return 0;
};

/** Every matching file in a server's `/history`, newest first — other clients' runs included. */
async function loadServerHistory(host: string, keep: KeepResult): Promise<RunResult[]> {
  const res = await fetch(`${comfyHttpFor(host)}/history?max_items=${MAX_RESULTS}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = await res.json() as Record<string, HistoryRecord>;
  const runs = Object.entries(all)
    .filter(([id, r]) => r.status?.completed !== false && !isImageJob(id))
    .sort(([, a], [, b]) => (b.prompt?.[0] ?? 0) - (a.prompt?.[0] ?? 0));
  const out: RunResult[] = [];
  for (const [id, r] of runs) {
    for (const node of Object.values(r.outputs ?? {})) {
      for (const img of node.images ?? []) {
        if (!keep(img)) continue;
        out.push({ url: viewUrl(img, host), filename: img.filename, promptId: id, createdAt: recordTime(r) });
      }
    }
  }
  return out.slice(0, MAX_RESULTS);
}

function merge(prev: RunResult[], fresh: RunResult[], onTop: boolean): RunResult[] {
  const known = new Set(prev.map(r => r.url));
  const add = fresh.filter(f => !known.has(f.url));
  if (!add.length) return prev;
  return (onTop ? [...add, ...prev] : [...prev, ...add]).slice(0, MAX_RESULTS);
}

/**
 * `keep` is fixed per store: a store is "the video results" or "the workflow results", and the
 * history it preloads has to be filtered the same way as the files its runs produce.
 */
export function createRunStore(keep: KeepResult = keepAll, hideKey?: string): RunStore {
  // Per-store mutable bookkeeping that is not UI state.
  let unsubscribe: (() => void) | null = null;
  let attached = 0;
  type Timing = { graph: ApiGraph; start: number; node: string | null; since: number; nodeMs: Record<string, number> };
  type Pending = { source: RunSource; timing: Timing; queuedAt: number; watchdog: ReturnType<typeof setInterval> | null; nodeNames: Record<string, string> };
  /** Our runs that have not finished, by prompt id (insertion order = queue order). */
  const pending = new Map<string, Pending>();
  /** Runs still building their graph / being queued. */
  let building = 0;
  let previewUrl: string | null = null;
  let historyFor: string | null = null;
  // Deleted urls: persisted. No key (or no storage) = this session only. Another tab of the app
  // edits the same list, so a change starts from what is saved now (`fresh`), and that tab's
  // changes arrive by the storage event — a stale copy here must never write a delete away.
  let hidden: string[] = [];
  const readHidden = (): string[] => {
    if (!hideKey) return hidden;
    try { return parseHidden(localStorage.getItem(hideKey)); } catch { return hidden; }
  };
  hidden = readHidden();
  const fresh = () => (hidden = readHidden());
  if (hideKey && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== hideKey) return;
      hidden = parseHidden(e.newValue);
      const now = store.getState().results;
      const results = withoutHidden(now, hidden);
      if (results !== now) store.setState({ results, latest: results[0] ?? null });
    });
  }
  const saveHidden = (next: string[]) => {
    hidden = next;
    if (hideKey) { try { localStorage.setItem(hideKey, JSON.stringify(next)); } catch { /* quota / private mode */ } }
  };
  /** Every merge goes through here, so a deleted result never comes back from a reload or the watchdog. */
  const mergeShown = (prev: RunResult[], fresh: RunResult[], onTop: boolean) => merge(prev, withoutHidden(fresh, hidden), onTop);

  const store = create<RunState>()((set, get) => {
    const clearPreview = () => {
      if (previewUrl) { const old = previewUrl; setTimeout(() => URL.revokeObjectURL(old), 3000); previewUrl = null; }
      set({ preview: null });
    };
    const jobsNow = (patch?: (j: RunJob) => RunJob): RunJob[] => {
      const prev = get().jobs;
      return [...pending.entries()].map(([promptId, p]) => {
        const j = prev.find((x) => x.promptId === promptId) ?? { promptId, queuedAt: p.queuedAt, running: false, progress: null };
        return patch ? patch(j) : j;
      });
    };
    const finish = () => {
      for (const p of pending.values()) if (p.watchdog) clearInterval(p.watchdog);
      pending.clear();
      set({ busy: building > 0, progress: null, currentNode: null, status: building > 0 ? 'Queued' : null, startedAt: null, jobs: [] });
      clearPreview();
      // Nobody on screen and nothing running: let the socket go.
      if (!attached) release();
    };
    /** One of ours is done (finished, failed or cancelled): drop it; the last one ends the busy state. */
    const done = (promptId: string) => {
      const p = pending.get(promptId);
      if (!p) return;
      if (p.watchdog) clearInterval(p.watchdog);
      pending.delete(promptId);
      if (!pending.size && !building) { finish(); return; }
      const first = pending.values().next().value as Pending | undefined;
      set({ jobs: jobsNow(), progress: null, currentNode: null, startedAt: first?.queuedAt ?? null });
    };
    const release = () => {
      if (unsubscribe && !attached && !get().busy) { unsubscribe(); unsubscribe = null; set({ connected: false }); }
    };
    const onEvent = (ev: ComfyEvent) => {
      if ('promptId' in ev && ev.promptId && pending.size && !pending.has(ev.promptId)) return; // another client's job
      switch (ev.type) {
        case 'status':
          return set({ queueRemaining: ev.queueRemaining });
        case 'execution_start': {
          const p = pending.get(ev.promptId);
          if (p) p.timing.start = p.timing.since = performance.now();
          return set({ status: 'Running', progress: null, jobs: jobsNow((j) => (j.promptId === ev.promptId ? { ...j, running: true } : j)), ...(p ? { startedAt: p.queuedAt } : {}) });
        }
        case 'executing': {
          const p = pending.get(ev.promptId);
          const t = p?.timing;
          if (t) {
            const now = performance.now();
            if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
            t.node = ev.node ?? null;
            t.since = now;
          }
          if (ev.node == null) return;             // null means "this prompt is done"
          const names = p?.nodeNames ?? {};
          return set({ currentNode: names[ev.node] ?? `node ${ev.node}`, progress: null, jobs: p ? jobsNow((j) => (j.promptId === ev.promptId ? { ...j, running: true, progress: null } : j)) : get().jobs });
        }
        case 'progress': {
          const progress = ev.max > 0 ? ev.value / ev.max : null;
          return set({ progress, jobs: pending.has(ev.promptId) ? jobsNow((j) => (j.promptId === ev.promptId ? { ...j, running: true, progress } : j)) : get().jobs });
        }
        case 'binary': {
          if (!get().busy) return;
          const url = URL.createObjectURL(new Blob([ev.bytes as BlobPart], { type: ev.mime }));
          // Revoke the old frame a little later: it stays on screen until this one decoded (next/ item 41).
          const old = previewUrl;
          if (old) setTimeout(() => URL.revokeObjectURL(old), 3000);
          previewUrl = url;
          return set({ preview: url });
        }
        case 'execution_success': {
          const p = pending.get(ev.promptId);
          if (p) {
            const t = p.timing;
            const now = performance.now();
            if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
            try { p.source.onFinished?.({ graph: t.graph, nodeMs: t.nodeMs, totalMs: now - t.start }); } catch { /* best effort */ }
            playCompleteSound();
            done(ev.promptId);
          }
          return;
        }
        case 'executed': {
          const host = get().host;
          if (!host) return;
          const p = pending.get(ev.promptId);
          if (!p && isImageJob(ev.promptId)) return; // the image history has it
          const saved = ev.images.filter(keep);
          if (!saved.length) return;
          const made = saved.map(img => ({ url: viewUrl(img, host), filename: img.filename, promptId: ev.promptId, createdAt: Date.now(), ...(p ? { durationMs: Date.now() - p.queuedAt } : {}) }));
          const results = mergeShown(get().results, made, true);
          return set({ results, latest: results[0] ?? null });
        }
        case 'execution_error':
          if (!pending.has(ev.promptId)) return;
          set({ error: ev.message });
          return done(ev.promptId);
        default:
          return;
      }
    };
    const listen = () => {
      const host = get().host;
      if (!host || unsubscribe) return;
      unsubscribe = subscribeComfy(host, {
        onOpen: () => set({ connected: true }),
        onClose: () => set({ connected: false }),
        onEvent,
      });
    };

    return {
      host: null, busy: false, status: null, error: null, results: [], latest: null, progress: null,
      currentNode: null, preview: null, connected: false, queueRemaining: 0, startedAt: null, jobs: [],

      setHost: (host) => {
        if (host === get().host) return;
        // A run in flight belongs to the old host; keep listening to it until it ends.
        if (get().busy) return;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        set({ host, connected: false, results: [], latest: null });
        if (!host) return;
        if (attached) listen();
        historyFor = host;
        void loadServerHistory(host, keep).then(found => {
          if (get().host !== host || historyFor !== host) return;
          const results = mergeShown(get().results, found, false);
          set({ results, latest: results[0] ?? null });
        }).catch(() => { /* no history is not an error worth showing */ });
      },

      attach: () => {
        attached++;
        listen();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          attached--;
          release();
        };
      },

      run: async (src) => {
        const host = get().host;
        if (!host) return;
        const first = !get().busy;
        building++;
        set({ error: null, busy: true, ...(first ? { status: 'Queued', startedAt: Date.now() } : {}) });
        if (first) clearPreview();
        listen();
        const settle = (error?: string) => {
          building--;
          if (error) set({ error });
          if (!pending.size && !building) { set({ busy: false, status: null, startedAt: null }); release(); }
        };
        try {
          const built = await src.build();
          if ('error' in built) { settle(built.error); return; }
          const { graph, warnings = [] } = built;
          if (warnings.length) set({ status: warnings[0] });
          const nodeNames = Object.fromEntries(Object.entries(graph).map(([id, n]) => {
            const node = n as { class_type: string; _meta?: { title?: string } };
            return [id, node._meta?.title || node.class_type];
          }));
          const queued = await queueGraph(host, graph);
          if (!queued.ok) { settle(queued.error); return; }
          const id = queued.promptId;
          const now = performance.now();
          const entry: Pending = { source: src, timing: { graph, start: now, node: null, since: now, nodeMs: {} }, queuedAt: Date.now(), watchdog: null, nodeNames };
          pending.set(id, entry);
          building--;
          set({ jobs: jobsNow(), startedAt: get().startedAt ?? entry.queuedAt });
          playSubmitSound();

          entry.watchdog = setInterval(async () => {
            if (!pending.has(id)) { if (entry.watchdog) clearInterval(entry.watchdog); return; }
            try {
              const res = await fetch(`${comfyHttpFor(host)}/history/${id}`);
              const rec = (await res.json())?.[id];
              if (!rec?.status?.completed) return;
              const found: RunResult[] = [];
              for (const out of Object.values(rec.outputs ?? {}) as Array<{ images?: HistoryImage[] }>) {
                for (const img of out.images ?? []) {
                  if (keep(img)) found.push({ url: viewUrl(img, host), filename: img.filename, promptId: id, createdAt: Date.now(), durationMs: Date.now() - entry.queuedAt });
                }
              }
              const results = mergeShown(get().results, found, true);
              set({ results, latest: results[0] ?? null });
              done(id);
            } catch { /* the socket is still the primary path */ }
          }, WATCHDOG_MS);
        } catch (err) {
          settle(err instanceof Error ? err.message : String(err));
        }
      },

      cancel: async (promptId) => {
        const host = get().host;
        const running = get().jobs.find((j) => j.running)?.promptId;
        const ids = promptId ? [promptId] : [...pending.keys()];
        if (host) {
          // Waiting ones come off the server's queue; the running one (or, for "cancel all" when
          // none has reported running yet, whatever runs: the old Stop) is interrupted.
          for (const id of ids) {
            if (id === running) continue;
            try { await deleteQueuedPrompt(host, id); } catch { /* best effort */ }
          }
          if ((running && ids.includes(running)) || (!running && !promptId)) {
            try { await fetch(`${comfyHttpFor(host)}/interrupt`, { method: 'POST' }); } catch { /* best effort */ }
          }
        }
        if (promptId) done(promptId); else finish();
      },

      clearError: () => set({ error: null }),

      removeResult: (url) => {
        saveHidden(hideUrl(fresh(), url));
        const results = withoutHidden(get().results, [url]);
        if (results.length !== get().results.length) set({ results, latest: results[0] ?? null });
      },

      hideUrls: (urls) => {
        if (!urls.length) return;
        let next = fresh();
        for (const u of urls) next = hideUrl(next, u);
        saveHidden(next);
        const results = withoutHidden(get().results, urls);
        if (results.length !== get().results.length) set({ results, latest: results[0] ?? null });
      },

      unhideUrls: (urls) => {
        const before = fresh();
        let next = before;
        for (const u of urls) next = unhideUrl(next, u);
        if (next.length !== before.length) saveHidden(next);
      },

      restoreResult: (result, index) => {
        saveHidden(unhideUrl(fresh(), result.url));
        const results = insertResult(get().results, index, result);
        set({ results, latest: results[0] ?? null });
      },
    };
  });

  return store;
}
