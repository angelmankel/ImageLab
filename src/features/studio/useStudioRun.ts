/**
 * Raw `/object_info`, and running the loaded workflow.
 *
 * The generate view keeps a digest of object_info (sampler names, model lists) because that is all
 * its fixed pipeline needs. Studio needs the whole thing: it has to describe a node nobody
 * anticipated, so it holds the raw document and reads specs out of it on demand.
 *
 * The runner itself (`useComfyRun`) takes where the graph comes from and which saved files count as
 * its results, so the Video view drives its own graph through the same machinery.
 *
 * Results are tracked here rather than through the generate view's history so the two can never
 * corrupt each other's state. On open, Studio reads the server's own `/history`, so every image the
 * server still holds is there after a reload or on another device; after that the socket adds each
 * new image as it is saved. Newest first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { comfyHttpFor, queueGraph, viewUrl } from '@/lib/comfy';
import { playCompleteSound, playSubmitSound } from '@/lib/sounds';
import { subscribeComfy, type ComfyEvent } from '@/lib/comfyBus';
import type { ApiGraph, ObjectInfo } from '@/lib/workflowGraph';
import { buildApiGraph } from './params';
import { useStudio } from './studioStore';

/** Raw object_info for a host, fetched once per host and kept for the session. */
const infoCache = new Map<string, ObjectInfo>();

export function useObjectInfo(host: string | null): { info: ObjectInfo | null; error: string | null } {
  const [info, setInfo] = useState<ObjectInfo | null>(host ? infoCache.get(host) ?? null : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) { setInfo(null); return; }
    const cached = infoCache.get(host);
    if (cached) { setInfo(cached); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${comfyHttpFor(host)}/object_info`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as ObjectInfo;
        infoCache.set(host, json);
        if (!cancelled) { setInfo(json); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [host]);

  return { info, error };
}

export interface StudioResult {
  url: string;
  filename: string;
  promptId: string;
  createdAt: number;
}

export interface StudioRun {
  run: () => Promise<void>;
  cancel: () => Promise<void>;
  busy: boolean;
  status: string | null;
  error: string | null;
  results: StudioResult[];
  /** Newest result, or null before anything has finished. */
  latest: StudioResult | null;
  /** 0..1 through the current node's steps, or null when nothing is sampling. */
  progress: number | null;
  /** The node ComfyUI is executing, as the workflow names it. */
  currentNode: string | null;
  /** Object URL of the latest live preview frame, or null. */
  preview: string | null;
  /** True while the socket for this host is up. */
  connected: boolean;
  /** Jobs waiting on this server, including other clients'. */
  queueRemaining: number;
}

const MAX_RESULTS = 300;

type HistoryImage = { filename: string; subfolder?: string; type?: string };
type HistoryRecord = {
  prompt?: [number, string, ...unknown[]];
  outputs?: Record<string, { images?: HistoryImage[] }>;
  status?: { completed?: boolean };
};

/**
 * Every image in a server's `/history`, newest first.
 *
 * Ordered by the queue number ComfyUI gives each prompt, which only goes up. That includes other
 * clients' runs on the same server, which is what "history" should mean on a shared box.
 */
async function loadServerHistory(host: string, keep: KeepResult): Promise<StudioResult[]> {
  const res = await fetch(`${comfyHttpFor(host)}/history?max_items=${MAX_RESULTS}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = await res.json() as Record<string, HistoryRecord>;
  const runs = Object.entries(all)
    .filter(([, r]) => r.status?.completed !== false)
    .sort(([, a], [, b]) => (b.prompt?.[0] ?? 0) - (a.prompt?.[0] ?? 0));
  const out: StudioResult[] = [];
  for (const [id, r] of runs) {
    for (const node of Object.values(r.outputs ?? {})) {
      for (const img of node.images ?? []) {
        if (!keep(img)) continue;
        out.push({ url: viewUrl(img, host), filename: img.filename, promptId: id, createdAt: r.prompt?.[0] ?? 0 });
      }
    }
  }
  return out.slice(0, MAX_RESULTS);
}
/** Safety net only: the socket drives everything, but a missed `executed` should not hang forever. */
const WATCHDOG_MS = 8000;

/** Which saved files are a view's results. */
export type KeepResult = (img: { filename: string; subfolder?: string }) => boolean;

/** What a view runs: how to make the graph, and which saved files are its results. */
export interface RunSource {
  /** The graph to queue, or why there is none. Called on Generate. */
  build: () => Promise<{ graph: ApiGraph; warnings?: string[] } | { error: string }>;
  keep?: KeepResult;
  /** A run of ours finished: the graph it ran, and how long each node took (cached nodes: none). */
  onFinished?: (run: FinishedRun) => void;
}

export interface FinishedRun { graph: ApiGraph; nodeMs: Record<string, number>; totalMs: number }

const keepAll: KeepResult = () => true;

/** Studio: the open workflow, with its knobs applied and a fresh seed. */
export function useStudioRun(host: string | null, info: ObjectInfo | null): StudioRun {
  return useComfyRun(host, {
    build: async () => {
      const { workflow, rerollSeeds } = useStudio.getState();
      if (!info || !workflow) return { error: 'Nothing open' };
      // A fresh seed per run is what anyone pressing Generate twice expects. ComfyUI's own
      // control_after_generate does this inside the editor; nothing does it for us out here.
      rerollSeeds();
      return buildApiGraph(workflow, info, useStudio.getState().currentValues());
    },
  });
}

export function useComfyRun(host: string | null, source: RunSource): StudioRun {
  // The latest source, read at run time: callers pass a fresh object every render.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const keep = source.keep ?? keepAll;
  const keepRef = useRef(keep);
  keepRef.current = keep;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [queueRemaining, setQueueRemaining] = useState(0);

  /** The prompt this hook is waiting on. Events for anything else belong to another client. */
  const waitingFor = useRef<string | null>(null);
  /** Node id → the workflow's own name for it, so progress can say "KSampler" not "5". */
  const nodeNames = useRef<Record<string, string>>({});
  /** Object URLs made for preview frames, revoked as they are replaced. */
  const previewUrl = useRef<string | null>(null);
  /** Per-node timing of the run being waited on, from the `executing` events. */
  const timing = useRef<{ graph: ApiGraph; start: number; node: string | null; since: number; nodeMs: Record<string, number> } | null>(null);

  const clearPreview = useCallback(() => {
    if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; }
    setPreview(null);
  }, []);

  const finish = useCallback(() => {
    waitingFor.current = null;
    setBusy(false);
    setProgress(null);
    setCurrentNode(null);
    setStatus(null);
    clearPreview();
  }, [clearPreview]);

  // ── The socket ─────────────────────────────────────────────────────────
  // Everything the UI shows while a job runs comes from here. Polling /history could only ever
  // report that a run had finished; the socket reports each node starting, each sampler step, and
  // each image the moment it is written — which is the difference between a spinner and knowing
  // what the machine is doing.
  useEffect(() => {
    if (!host) { setConnected(false); return; }
    const onEvent = (ev: ComfyEvent) => {
      if ('promptId' in ev && ev.promptId && waitingFor.current && ev.promptId !== waitingFor.current) {
        return;                       // another client's job on the same server
      }
      switch (ev.type) {
        case 'status':
          return setQueueRemaining(ev.queueRemaining);

        case 'execution_start':
          if (timing.current && ev.promptId === waitingFor.current) {
            timing.current.start = timing.current.since = performance.now();
          }
          setStatus('Running');
          return setProgress(null);

        case 'executing': {
          // Time each node: from its `executing` to the next one (null = the prompt is done).
          const t = timing.current;
          if (t && ev.promptId === waitingFor.current) {
            const now = performance.now();
            if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
            t.node = ev.node ?? null;
            t.since = now;
          }
        }
          if (ev.node == null) return;           // null means "this prompt is done"
          setCurrentNode(nodeNames.current[ev.node] ?? `node ${ev.node}`);
          return setProgress(null);

        case 'progress':
          return setProgress(ev.max > 0 ? ev.value / ev.max : null);

        case 'binary': {
          // A live preview frame. Swap the object URL and revoke the old one, or a long run leaks
          // one blob per step.
          const url = URL.createObjectURL(new Blob([ev.bytes as BlobPart], { type: ev.mime }));
          if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
          previewUrl.current = url;
          return setPreview(url);
        }

        case 'execution_success':
          // `executed` only fires for nodes that produced an output, so a workflow ending in a
          // node that saves nothing would leave the button spinning until the watchdog. This is
          // ComfyUI saying the whole prompt is done, which is the signal to trust.
          if (ev.promptId === waitingFor.current) {
            const t = timing.current;
            if (t) {
              const now = performance.now();
              if (t.node) t.nodeMs[t.node] = (t.nodeMs[t.node] ?? 0) + (now - t.since);
              timing.current = null;
              try { sourceRef.current.onFinished?.({ graph: t.graph, nodeMs: t.nodeMs, totalMs: now - t.start }); } catch { /* timing is best effort */ }
            }
            playCompleteSound();
            finish();
          }
          return;

        case 'executed': {
          const saved = ev.images.filter(img => keepRef.current(img));
          if (!saved.length) return;
          const made = saved.map(img => ({
            url: viewUrl(img, host), filename: img.filename, promptId: ev.promptId, createdAt: Date.now(),
          }));
          // Images arrive per node as they are saved, so a workflow with several SaveImage nodes
          // shows each one as it lands rather than all of them at the end.
          setResults(prev => [...made, ...prev].slice(0, MAX_RESULTS));
          return;   // the run ends on execution_success, not on the first node that saved something
        }

        case 'execution_error':
          setError(ev.message);
          return finish();

        default:
          return;
      }
    };

    return subscribeComfy(host, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onEvent,
    });
  }, [host, finish]);

  // What the server already made, so history is there before anything is generated here.
  useEffect(() => {
    if (!host) { setResults([]); return; }
    let cancelled = false;
    void loadServerHistory(host, keepRef.current).then(found => {
      if (cancelled) return;
      setResults(prev => {
        // Anything the socket delivered while this was loading stays on top.
        const known = new Set(prev.map(r => r.url));
        return [...prev, ...found.filter(f => !known.has(f.url))].slice(0, MAX_RESULTS);
      });
    }).catch(() => { /* no history is not an error worth showing */ });
    return () => { cancelled = true; };
  }, [host]);

  // Revoke the last preview URL when the hook goes away.
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  const run = useCallback(async () => {
    if (!host) return;

    setError(null);
    setBusy(true);
    setStatus('Queued');
    clearPreview();
    try {
      const built = await sourceRef.current.build();
      if ('error' in built) { setError(built.error); setBusy(false); setStatus(null); return; }
      const { graph, warnings = [] } = built;
      if (warnings.length) setStatus(warnings[0]);

      // Name the nodes before submitting, so the very first `executing` can be described.
      nodeNames.current = Object.fromEntries(Object.entries(graph).map(([id, n]) => {
        const node = n as { class_type: string; _meta?: { title?: string } };
        return [id, node._meta?.title || node.class_type];
      }));

      const queued = await queueGraph(host, graph);
      if (!queued.ok) { setError(queued.error); setBusy(false); setStatus(null); return; }
      waitingFor.current = queued.promptId;
      timing.current = { graph, start: performance.now(), node: null, since: performance.now(), nodeMs: {} };
      playSubmitSound();

      // Watchdog. The socket should deliver everything, but a connection that drops mid-run would
      // otherwise leave the button disabled forever. One /history check settles it.
      const id = queued.promptId;
      const watchdog = setInterval(async () => {
        if (waitingFor.current !== id) { clearInterval(watchdog); return; }
        try {
          const res = await fetch(`${comfyHttpFor(host)}/history/${id}`);
          const rec = (await res.json())?.[id];
          if (!rec?.status?.completed) return;
          const found: StudioResult[] = [];
          for (const out of Object.values(rec.outputs ?? {}) as Array<{ images?: Array<{ filename: string; subfolder?: string; type?: string }> }>) {
            for (const img of out.images ?? []) {
              if (!keepRef.current(img)) continue;
              found.push({ url: viewUrl(img, host), filename: img.filename, promptId: id, createdAt: Date.now() });
            }
          }
          if (found.length) {
            setResults(prev => {
              const known = new Set(prev.map(r => r.url));
              const fresh = found.filter(f => !known.has(f.url));
              return fresh.length ? [...fresh, ...prev].slice(0, MAX_RESULTS) : prev;
            });
          }
          clearInterval(watchdog);
          finish();
        } catch { /* the socket is still the primary path */ }
      }, WATCHDOG_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStatus(null);
    }
  }, [host, clearPreview, finish]);

  const cancel = useCallback(async () => {
    if (!host) return;
    try { await fetch(`${comfyHttpFor(host)}/interrupt`, { method: 'POST' }); } catch { /* best effort */ }
    finish();
  }, [host, finish]);

  return {
    run, cancel, busy, status, error, results, latest: results[0] ?? null,
    progress, currentNode, preview, connected, queueRemaining,
  };
}
