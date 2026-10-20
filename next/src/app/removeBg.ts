/**
 * Item 43: remove the background of an image on a ComfyUI server (core BiRefNet). The canvas
 * toolbar's Remove BG button and the viewer use `removeBackground`; the steps agent's Remove BG
 * step builds its graph with `removeBgGraph` (re-exported from the pure `removeBgGraph.ts`).
 *
 * Run: fetch the picture → upload it to input/imagelab → queue the graph → wait on the shared
 * websocket bus (`subscribeComfy`, never a second socket) → read /history → fetch the RGBA PNG.
 * The server: the one the picture already lives on when it can run images, else the image server.
 * A server without the core nodes / model gets a plain "missing" error, not a failed job.
 */
import { useStore } from '@/lib/store';
import { comfyHttpFor, queueGraph, uploadImage, loadImageRef, viewUrl } from '@/lib/comfy';
import { subscribeComfy, type ComfyImageRef } from '@/lib/comfyBus';
import { canRunImages } from '@/lib/serverRoles';
import { modeHostNow } from '@/features/workspace/modeHost';
import { removeBgGraph, pickRemoveBgModel, noBgName, REMOVE_BG_OUT } from './removeBgGraph';

export { removeBgGraph, pickRemoveBgModel, noBgName, REMOVE_BG_MODEL, REMOVE_BG_OUT, REMOVE_BG_NODES } from './removeBgGraph';

export interface RemoveBgResult {
  /** The cut-out, an RGBA PNG. */
  blob: Blob;
  /** Where it was saved on the server (output/imagelab/removebg_*.png) — a history entry can point at it. */
  image: ComfyImageRef;
  host: string;
  serverId: string | null;
  promptId: string;
}

const TIMEOUT_MS = 5 * 60_000;
const modelCache = new Map<string, Promise<string[] | null>>();

/** The background-removal models a host lists, or null when it lacks the core node. Cached per host. */
export function removeBgModels(host: string): Promise<string[] | null> {
  let p = modelCache.get(host);
  if (!p) {
    p = fetch(`${comfyHttpFor(host)}/object_info/LoadBackgroundRemovalModel`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const spec = j?.LoadBackgroundRemovalModel?.input?.required?.bg_removal_name;
        if (!spec) return null;
        const opts = Array.isArray(spec[0]) ? spec[0] : spec[1]?.options;
        return Array.isArray(opts) ? (opts as string[]) : [];
      })
      .catch(() => null);
    modelCache.set(host, p);
    // A failure (offline, old ComfyUI) is not remembered: the next click asks again.
    void p.then((v) => { if (v === null) modelCache.delete(host); });
  }
  return p;
}

/** The server for a picture: its own (the /view URL names the host) when it runs images, else the image server. */
export function removeBgServer(url: string): { host: string; serverId: string | null } | null {
  const servers = useStore.getState().servers;
  const own = servers.find((s) => canRunImages(s) && url.startsWith(`${comfyHttpFor(s.host)}/`));
  if (own) return { host: own.host, serverId: own.id };
  const host = modeHostNow('image');
  if (!host) return null;
  return { host, serverId: servers.find((s) => s.host === host)?.id ?? null };
}

/** Remove the background; resolves with the RGBA PNG plus where the server saved it. */
export async function removeBackgroundRun(url: string, filename: string, opts: { host?: string; model?: string; signal?: AbortSignal } = {}): Promise<RemoveBgResult> {
  const target = opts.host ? { host: opts.host, serverId: useStore.getState().servers.find((s) => s.host === opts.host)?.id ?? null } : removeBgServer(url);
  if (!target) throw new Error('No ComfyUI server is connected.');
  const { host, serverId } = target;

  const models = await removeBgModels(host);
  if (models === null) throw new Error('This server has no background removal node — update ComfyUI (core "Remove Background").');
  const model = opts.model ?? pickRemoveBgModel(models);
  if (!model) throw new Error('No background removal model on this server — put birefnet.safetensors in models/background_removal.');

  const src = await fetch(url, { signal: opts.signal });
  if (!src.ok) throw new Error(`Could not read the picture (HTTP ${src.status})`);
  const up = await uploadImage(host, await src.blob(), noBgName(filename).replace(/_nobg\.png$/, '_src.png'));

  // Listen before queueing: a cached graph can finish before queueGraph's reply arrives.
  const done = new Map<string, { ok: boolean; message?: string }>();
  const images = new Map<string, ComfyImageRef[]>();
  let wake: (() => void) | null = null;
  const unsub = subscribeComfy(host, {
    onEvent: (ev) => {
      if (ev.type === 'executed' && ev.node === REMOVE_BG_OUT && ev.images.length) images.set(ev.promptId, ev.images);
      else if (ev.type === 'execution_success') done.set(ev.promptId, { ok: true });
      else if (ev.type === 'execution_error') done.set(ev.promptId, { ok: false, message: ev.message });
      else return;
      wake?.();
    },
  });
  try {
    const q = await queueGraph(host, removeBgGraph(loadImageRef(up), model));
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
      timer = setTimeout(() => finish(new Error('Remove BG timed out')), TIMEOUT_MS);
      wake = () => {
        const d = done.get(promptId);
        if (d) finish(d.ok ? undefined : new Error(d.message || 'Remove BG failed'));
      };
      // The socket can drop mid-run: /history every few seconds is the fallback.
      poll = setInterval(() => {
        void fetch(`${comfyHttpFor(host)}/history/${promptId}`).then((r) => r.json()).then((h) => {
          const e = h?.[promptId];
          if (!e) return;
          if (e.status?.status_str === 'error') done.set(promptId, { ok: false, message: 'Remove BG failed on the server' });
          else if (e.status?.completed) {
            const out = e.outputs?.[REMOVE_BG_OUT]?.images as ComfyImageRef[] | undefined;
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
      image = (h?.[promptId]?.outputs?.[REMOVE_BG_OUT]?.images as ComfyImageRef[] | undefined)?.[0];
    }
    if (!image) throw new Error('Remove BG produced no image');
    const res = await fetch(viewUrl(image, host), { signal: opts.signal });
    if (!res.ok) throw new Error(`Could not fetch the result (HTTP ${res.status})`);
    return { blob: await res.blob(), image, host, serverId, promptId };
  } finally {
    unsub();
  }
}

/** The contract: remove the background of the picture at `url`; resolves with the RGBA PNG. */
export async function removeBackground(url: string, filename: string): Promise<Blob> {
  return (await removeBackgroundRun(url, filename)).blob;
}
