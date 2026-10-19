/**
 * Raw `/object_info`, and the hook view of a run store.
 *
 * The generate view keeps a digest of object_info (sampler names, model lists) because that is all
 * its fixed pipeline needs. Studio needs the whole thing: it has to describe a node nobody
 * anticipated, so it holds the raw document and reads specs out of it on demand.
 *
 * The runs themselves live in module-level stores (`lib/comfyRunner.ts`; `studioRun.ts` and
 * `video/videoRun.ts`), so a run survives the view unmounting. `useRunStore` is the view's handle:
 * it points the store at the host, keeps the socket while mounted, and hands back the old
 * `StudioRun` shape so the panels did not have to change.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { comfyHttpFor } from '@/lib/comfy';
import type { RunResult, RunSource, RunStore } from '@/lib/comfyRunner';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { useWorkflowRun, workflowRunSource } from './studioRun';

export type { FinishedRun, KeepResult, RunSource } from '@/lib/comfyRunner';
export type StudioResult = RunResult;

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

export interface StudioRun {
  run: () => Promise<void>;
  cancel: () => Promise<void>;
  busy: boolean;
  status: string | null;
  error: string | null;
  results: StudioResult[];
  latest: StudioResult | null;
  progress: number | null;
  currentNode: string | null;
  preview: string | null;
  connected: boolean;
  queueRemaining: number;
}

/** A view's handle on a run store: the host it talks to, and the source its Generate queues. */
export function useRunStore(store: RunStore, host: string | null, source: RunSource): StudioRun {
  // The latest source, read at run time: callers pass a fresh object every render.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const setHost = store(s => s.setHost);
  const attach = store(s => s.attach);
  useEffect(() => { setHost(host); }, [host, setHost]);
  useEffect(() => attach(), [attach]);

  const busy = store(s => s.busy);
  const status = store(s => s.status);
  const error = store(s => s.error);
  const results = store(s => s.results);
  const latest = store(s => s.latest);
  const progress = store(s => s.progress);
  const currentNode = store(s => s.currentNode);
  const preview = store(s => s.preview);
  const connected = store(s => s.connected);
  const queueRemaining = store(s => s.queueRemaining);
  const run = useCallback(() => store.getState().run(sourceRef.current), [store]);
  const cancel = useCallback(() => store.getState().cancel(), [store]);

  return { run, cancel, busy, status, error, results, latest, progress, currentNode, preview, connected, queueRemaining };
}

/** Studio: the open workflow, with its knobs applied and a fresh seed. */
export function useStudioRun(host: string | null, info: ObjectInfo | null): StudioRun {
  return useRunStore(useWorkflowRun, host, workflowRunSource(info));
}
