/**
 * A ComfyUI run that outlives the view that started it.
 *
 * Video and Workflow each get one of these (`features/video/videoRun.ts`, `features/studio/
 * studioRun.ts`). The state lives in a zustand store, not in a component, so switching to Image
 * while a video renders keeps the run tracked, its progress visible in the job tray, and its
 * result landing in the strip when it is done. The socket is the shared bus (one per host); this
 * subscribes while a view is attached or a run is in flight, and lets go when neither is true.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { subscribeComfy, type ComfyEvent } from './comfyBus';
import { comfyHttpFor, queueGraph, viewUrl } from './comfy';
import { playCompleteSound, playSubmitSound } from './sounds';
import { isImageJob } from './promptOwners';
import type { ApiGraph } from './workflowGraph';

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

  /** Point the runner at a host (the view's server). Results reload from its `/history`. */
  setHost: (host: string | null) => void;
  /** A view is on screen: hold the socket open for it. Returns the release. */
  attach: () => () => void;
  run: (source: RunSource) => Promise<void>;
  cancel: () => Promise<void>;
  clearError: () => void;
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
export function createRunStore(keep: KeepResult = keepAll): RunStore {
  // Per-store mutable bookkeeping that is not UI state.
  let unsubscribe: (() => void) | null = null;
  let attached = 0;
  let waitingFor: string | null = null;
  let nodeNames: Record<string, string> = {};
  let previewUrl: string | null = null;
  let timing: { graph: ApiGraph; start: number; node: string | null; since: number; nodeMs: Record<string, number> } | null = null;
  let source: RunSource | null = null;
  let historyFor: string | null = null;

  const store = create<RunState>()((set, get) => {
    const clearPreview = () => {
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      set({ preview: null });
    };
    const finish = () => {
      waitingFor = null;
      set({ busy: false, progress: null, currentNode: null, status: null, startedAt: null });
      clearPreview();
      // Nobody on screen and nothing running: let the socket go.
      if (!attached) release();
    };
    const release = () => {
      if (unsubscribe && !attached && !get().busy) { unsubscribe(); unsubscribe = null; set({ connected: false }); }
    };
    const onEvent = (ev: ComfyEvent) => {
      if ('promptId' in ev && ev.promptId && waitingFor && ev.promptId !== waitingFor) return; // another client's job
      switch (ev.type) {
        case 'status':
          return set({ queueRemaining: ev.queueRemaining });
        case 'execution_start':
          if (timing && ev.promptId === waitingFor) timing.start = timing.since = performance.now();
          return set({ status: 'Running', progress: null });
        case 'executing': {
          const t = timing;
          if (t && ev.promptId === waitingFor) {
            const now = performance.now();
            if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
            t.node = ev.node ?? null;
            t.since = now;
          }
          if (ev.node == null) return;             // null means "this prompt is done"
          return set({ currentNode: nodeNames[ev.node] ?? `node ${ev.node}`, progress: null });
        }
        case 'progress':
          return set({ progress: ev.max > 0 ? ev.value / ev.max : null });
        case 'binary': {
          if (!get().busy) return;
          const url = URL.createObjectURL(new Blob([ev.bytes as BlobPart], { type: ev.mime }));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          previewUrl = url;
          return set({ preview: url });
        }
        case 'execution_success':
          if (ev.promptId === waitingFor) {
            const t = timing;
            if (t) {
              const now = performance.now();
              if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
              timing = null;
              try { source?.onFinished?.({ graph: t.graph, nodeMs: t.nodeMs, totalMs: now - t.start }); } catch { /* best effort */ }
            }
            playCompleteSound();
            finish();
          }
          return;
        case 'executed': {
          const host = get().host;
          if (!host) return;
          if (ev.promptId !== waitingFor && isImageJob(ev.promptId)) return; // the image history has it
          const saved = ev.images.filter(keep);
          if (!saved.length) return;
          const took = get().startedAt;
          const made = saved.map(img => ({ url: viewUrl(img, host), filename: img.filename, promptId: ev.promptId, createdAt: Date.now(), ...(took ? { durationMs: Date.now() - took } : {}) }));
          const results = merge(get().results, made, true);
          return set({ results, latest: results[0] ?? null });
        }
        case 'execution_error':
          set({ error: ev.message });
          return finish();
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
      currentNode: null, preview: null, connected: false, queueRemaining: 0, startedAt: null,

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
          const results = merge(get().results, found, false);
          set({ results, latest: results[0] ?? null });
        }).catch(() => { /* no history is not an error worth showing */ });
      },

      attach: () => {
        attached++;
        listen();
        let done = false;
        return () => {
          if (done) return;
          done = true;
          attached--;
          release();
        };
      },

      run: async (src) => {
        const host = get().host;
        if (!host || get().busy) return;
        source = src;
        set({ error: null, busy: true, status: 'Queued', startedAt: Date.now() });
        clearPreview();
        listen();
        try {
          const built = await src.build();
          if ('error' in built) { set({ error: built.error, busy: false, status: null, startedAt: null }); release(); return; }
          const { graph, warnings = [] } = built;
          if (warnings.length) set({ status: warnings[0] });
          nodeNames = Object.fromEntries(Object.entries(graph).map(([id, n]) => {
            const node = n as { class_type: string; _meta?: { title?: string } };
            return [id, node._meta?.title || node.class_type];
          }));
          const queued = await queueGraph(host, graph);
          if (!queued.ok) { set({ error: queued.error, busy: false, status: null, startedAt: null }); release(); return; }
          waitingFor = queued.promptId;
          timing = { graph, start: performance.now(), node: null, since: performance.now(), nodeMs: {} };
          playSubmitSound();

          const id = queued.promptId;
          const watchdog = setInterval(async () => {
            if (waitingFor !== id) { clearInterval(watchdog); return; }
            try {
              const res = await fetch(`${comfyHttpFor(host)}/history/${id}`);
              const rec = (await res.json())?.[id];
              if (!rec?.status?.completed) return;
              const found: RunResult[] = [];
              for (const out of Object.values(rec.outputs ?? {}) as Array<{ images?: HistoryImage[] }>) {
                for (const img of out.images ?? []) {
                  if (keep(img)) found.push({ url: viewUrl(img, host), filename: img.filename, promptId: id, createdAt: Date.now(), ...(get().startedAt ? { durationMs: Date.now() - get().startedAt! } : {}) });
                }
              }
              const results = merge(get().results, found, true);
              set({ results, latest: results[0] ?? null });
              clearInterval(watchdog);
              finish();
            } catch { /* the socket is still the primary path */ }
          }, WATCHDOG_MS);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err), busy: false, status: null, startedAt: null });
          release();
        }
      },

      cancel: async () => {
        const host = get().host;
        if (host) { try { await fetch(`${comfyHttpFor(host)}/interrupt`, { method: 'POST' }); } catch { /* best effort */ } }
        finish();
      },

      clearError: () => set({ error: null }),
    };
  });

  return store;
}
