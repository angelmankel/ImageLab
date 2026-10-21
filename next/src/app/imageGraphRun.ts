/**
 * Run a small "picture in → picture out" ComfyUI graph (Remove BG, the Edit mode's server tools,
 * saving an edited picture as an output). Upload the picture to input/imagelab → queue the graph →
 * wait on the shared websocket bus (`subscribeComfy`, never a second socket; /history polling is the
 * fallback when the socket drops) → read the output node's first image → fetch it.
 */
import { comfyHttpFor, queueGraph, uploadImage, loadImageRef, viewUrl } from '@/lib/comfy';
import { subscribeComfy, type ComfyImageRef } from '@/lib/comfyBus';

export interface ImageGraphResult {
  blob: Blob;
  /** Where the server saved it (an output a history entry can point at). */
  image: ComfyImageRef;
  promptId: string;
}

type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

const TIMEOUT_MS = 5 * 60_000;

export async function runImageGraph(host: string, src: Blob, uploadName: string, build: (ref: string) => Graph, outNode: string,
  opts: { signal?: AbortSignal; label?: string } = {}): Promise<ImageGraphResult> {
  const label = opts.label ?? 'The tool';
  const up = await uploadImage(host, src, uploadName);
  // Listen before queueing: a cached graph can finish before queueGraph's reply arrives.
  const done = new Map<string, { ok: boolean; message?: string }>();
  const images = new Map<string, ComfyImageRef[]>();
  let wake: (() => void) | null = null;
  const unsub = subscribeComfy(host, {
    onEvent: (ev) => {
      if (ev.type === 'executed' && ev.node === outNode && ev.images.length) images.set(ev.promptId, ev.images);
      else if (ev.type === 'execution_success') done.set(ev.promptId, { ok: true });
      else if (ev.type === 'execution_error') done.set(ev.promptId, { ok: false, message: ev.message });
      else return;
      wake?.();
    },
  });
  try {
    const q = await queueGraph(host, build(loadImageRef(up)));
    if (!q.ok) throw new Error(q.error);
    const promptId = q.promptId;
    await new Promise<void>((resolve, reject) => {
      let poll: ReturnType<typeof setInterval> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (err?: Error) => {
        clearTimeout(timer); clearInterval(poll); wake = null;
        opts.signal?.removeEventListener('abort', abort);
        if (err) reject(err); else resolve();
      };
      const abort = () => finish(new DOMException('Aborted', 'AbortError') as unknown as Error);
      opts.signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => finish(new Error(`${label} timed out`)), TIMEOUT_MS);
      wake = () => {
        const d = done.get(promptId);
        if (d) finish(d.ok ? undefined : new Error(d.message || `${label} failed`));
      };
      poll = setInterval(() => {
        void fetch(`${comfyHttpFor(host)}/history/${promptId}`).then((r) => r.json()).then((h) => {
          const e = h?.[promptId];
          if (!e) return;
          if (e.status?.status_str === 'error') done.set(promptId, { ok: false, message: `${label} failed on the server` });
          else if (e.status?.completed) {
            const out = e.outputs?.[outNode]?.images as ComfyImageRef[] | undefined;
            if (out?.length) images.set(promptId, out);
            done.set(promptId, { ok: true });
          } else return;
          wake?.();
        }).catch(() => { /* next tick */ });
      }, 3000);
      wake();
    });
    let image = images.get(promptId)?.[0];
    if (!image) {
      const h = await fetch(`${comfyHttpFor(host)}/history/${promptId}`).then((r) => r.json());
      image = (h?.[promptId]?.outputs?.[outNode]?.images as ComfyImageRef[] | undefined)?.[0];
    }
    if (!image) throw new Error(`${label} produced no image`);
    const res = await fetch(viewUrl(image, host), { signal: opts.signal });
    if (!res.ok) throw new Error(`Could not fetch the result (HTTP ${res.status})`);
    return { blob: await res.blob(), image, promptId };
  } finally {
    unsub();
  }
}

/** The input spec of a node class on a host, or null when the server lacks the node. Cached per host. */
const infoCache = new Map<string, Promise<Record<string, unknown> | null>>();
export function nodeInfo(host: string, cls: string): Promise<Record<string, unknown> | null> {
  const key = `${host}|${cls}`;
  let p = infoCache.get(key);
  if (!p) {
    p = fetch(`${comfyHttpFor(host)}/object_info/${encodeURIComponent(cls)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j[cls] ? (j[cls] as Record<string, unknown>) : null))
      .catch(() => null);
    infoCache.set(key, p);
    // An unreachable server is not remembered: the next look asks again.
    void p.then((v) => { if (v === null) setTimeout(() => infoCache.delete(key), 30_000); });
  }
  return p;
}

/** The options of a combo input (`input.required[name]`) of a node, or null when the node is missing. */
export async function comboOptions(host: string, cls: string, input: string): Promise<string[] | null> {
  const info = await nodeInfo(host, cls) as { input?: { required?: Record<string, unknown[]>; optional?: Record<string, unknown[]> } } | null;
  if (!info) return null;
  const spec = info.input?.required?.[input] ?? info.input?.optional?.[input];
  if (!spec) return [];
  const opts = Array.isArray(spec[0]) ? spec[0] : (spec[1] as { options?: unknown } | undefined)?.options;
  return Array.isArray(opts) ? (opts as string[]) : [];
}
