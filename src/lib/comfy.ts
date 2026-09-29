import type { Layer, WorkflowState, ServerInfo, HistoryEntry } from './types';
import { compileLayers } from './prompt';
import { subscribeComfy } from './comfyBus';
import { comfyHttpFor, clientId, viewUrl } from './comfyHost';
import { FALLBACKS, uid } from './storage';
import { resizeDataUrlForUpload } from '@/features/inputImage/imageOps';
import { buildGraph, type InpaintConfig } from './graphs';

/**
 * REST + WebSocket client for ComfyUI.
 *
 * Every call is host-scoped — there's no longer a single "active" server, so
 * the caller passes which server's host to talk to. Over HTTPS we MUST use
 * https/wss (the browser blocks plain-HTTP requests as mixed content), so the
 * user is expected to expose each ComfyUI server on an https-capable hostname.
 */
// Host addressing and the client id live in `comfyHost.ts` so the websocket bus can use them
// without importing this module. Re-exported here: every existing import site still works.
export { comfyHttpFor, comfyWsFor, viewUrl, clientId } from './comfyHost';
// The graph builders live in `graphs/`, one per model family.
export { buildGraph, type BuildGraphResult, type InpaintConfig } from './graphs';

/**
 * POST an image to ComfyUI's `input/` folder. Returns the filename the
 * server stored it under, ready to use as a `LoadImage` input. Uploads to
 * `input/imagelab/<name>` so we don't clobber the user's own uploads.
 */
export type UploadedImage = { name: string; subfolder: string; type: string };

export async function uploadImage(
  host: string,
  blob: Blob,
  filename: string,
): Promise<UploadedImage> {
  const fd = new FormData();
  fd.append('image', blob, filename);
  fd.append('subfolder', 'imagelab');
  fd.append('overwrite', 'true');
  const res = await fetch(`${comfyHttpFor(host)}/upload/image`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload HTTP ${res.status}`);
  const json = await res.json();
  return {
    name: json.name as string,
    subfolder: (json.subfolder as string) || '',
    type: (json.type as string) || 'input',
  };
}

/** `LoadImage` expects "<subfolder>/<name>" when a subfolder is used. */
export function loadImageRef(up: UploadedImage): string {
  return up.subfolder ? `${up.subfolder}/${up.name}` : up.name;
}

export async function fetchServerInfo(host: string): Promise<ServerInfo> {
  const res = await fetch(`${comfyHttpFor(host)}/object_info`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const info = await res.json();
  // Combo inputs come in two shapes ComfyUI uses interchangeably:
  //   legacy: [[...options], {config?}]
  //   newer:  ['COMBO', {options: [...], ...}]
  const list = (spec: unknown): string[] | null => {
    if (!Array.isArray(spec)) return null;
    if (Array.isArray(spec[0])) return spec[0] as string[];
    const cfg = spec[1] as { options?: unknown } | undefined;
    if (cfg && Array.isArray(cfg.options)) return cfg.options as string[];
    return null;
  };
  const get = (cls: string, key: string) =>
    list(info[cls]?.input?.required?.[key]);
  // Embeddings are not a node input, so /object_info does not list them.
  const embeddings = await fetch(`${comfyHttpFor(host)}/embeddings`)
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return {
    samplers:      get('KSampler', 'sampler_name')              ?? FALLBACKS.samplers,
    schedulers:    get('KSampler', 'scheduler')                 ?? FALLBACKS.schedulers,
    models:        get('CheckpointLoaderSimple', 'ckpt_name')   ?? FALLBACKS.models,
    vaes:          get('VAELoader', 'vae_name')                 ?? FALLBACKS.vaes,
    loras:         get('LoraLoader', 'lora_name')               ?? FALLBACKS.loras,
    embeddings:    Array.isArray(embeddings) ? embeddings.map(String) : FALLBACKS.embeddings,
    tagModels:     get('WD14Tagger|pysssss', 'model')           ?? FALLBACKS.tagModels,
    upscaleModels: get('UpscaleModelLoader', 'model_name')      ?? FALLBACKS.upscaleModels,
    controlnets:   get('ControlNetLoader', 'control_net_name')  ?? FALLBACKS.controlnets,
  };
}

/**
 * One entry from the ImageLab custom node's model-hash cache.
 * `key` is the model's path relative to ComfyUI's models dir.
 */
export interface ModelHash {
  key: string;
  filename: string;
  hash: string;
  hashed_at: number;
}

export interface ModelHashes {
  version: string;
  models: ModelHash[];
}

/**
 * Fetch the model-hash cache from the ImageLab custom node
 * (`GET /imagelab/api/hashes`) on a ComfyUI server.
 *
 * Pass the previous response's `version` as `knownVersion` — the endpoint
 * answers `304` when nothing has changed, in which case this returns `null`.
 */
export async function fetchModelHashes(host: string, knownVersion?: string, signal?: AbortSignal): Promise<ModelHashes | null> {
  const timeout = AbortSignal.timeout(15_000);
  const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/hashes`, {
    headers: knownVersion ? { 'If-None-Match': `"${knownVersion}"` } : {},
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * One CivitAI download tracked by the ImageLab custom node. Mirrors the
 * node's `DownloadProgress.to_dict()`.
 */
export interface Download {
  version_id: number;
  model_id: number;
  folder: string;           // ComfyUI folder, e.g. "checkpoints" — "?" until resolved
  filename: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  error: string | null;
  started_at: number;
  updated_at: number;
}

/** Every download a server's node is tracking (active + finished). */
export async function fetchDownloads(host: string): Promise<Download[]> {
  const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/downloads`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body.downloads ?? [];
}

/**
 * Start a CivitAI download on a server. `folder` is a ComfyUI folder name;
 * omit it to let the node derive it from CivitAI's model type. Resolves once
 * the download is *queued* — poll `fetchDownloads` for progress.
 */
export async function startDownload(
  host: string,
  versionId: number,
  folder?: string,
  filename?: string,
): Promise<void> {
  const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/downloads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version_id: versionId, folder, filename }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

/** Cancel an in-flight download, or dismiss a finished/failed row. */
export async function cancelDownload(host: string, versionId: number): Promise<void> {
  const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/downloads/${versionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Delete a local model file (and drop it from the node's hash index). */
export async function deleteModel(host: string, folder: string, filename: string): Promise<void> {
  const path = filename.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(
    `${comfyHttpFor(host)}/imagelab/api/models/${encodeURIComponent(folder)}/${path}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

export type QueueResult =
  | { ok: true; promptId: string; positive: string; negative: string; nodeCount: number; clampNotes: string[] }
  | { ok: false; error: string };

/**
 * Resize the workflow's input image client-side and upload it to a single
 * server's input/ folder. Returns the `LoadImage` ref the graph should use
 * for that server, or null when the workflow has no input image.
 *
 * Split out from `queuePrompt` so callers driving non-generation graphs
 * (the image-tool runner) can upload once and reuse the ref; under
 * round-robin generation `queuePrompt` still uploads per-server because
 * each ComfyUI box has its own input/ namespace.
 */
export async function uploadInputImage(host: string, workflow: WorkflowState): Promise<string | null> {
  if (!workflow.inputImage) return null;
  const blob = await resizeDataUrlForUpload(workflow.inputImage.dataUrl, workflow.inputMaxSize, workflow.inputMinSize);
  const up = await uploadImage(host, blob, workflow.inputImage.name);
  return loadImageRef(up);
}

/** Inpaint source supplied by the from-canvas capture path. The composite
 *  blob is the wider context image (replaces `workflow.inputImage` for this
 *  one queue) and the mask blob is the same-size mask the graph will use. */
export type InpaintSource = {
  composite: Blob;
  mask: Blob;
  variant: 'destructive' | 'denoising';
  /** See `InpaintConfig.blendPx`. */
  blendPx: number;
  /** See `InpaintConfig.maskExpand`. */
  maskExpand: number;
  /** See `InpaintConfig.controlnet`. */
  controlnet: { model: string; strength: number } | null;
  /** See `InpaintConfig.contextExtend`. */
  contextExtend: number;
  /** See `InpaintConfig.targetSize`. */
  targetSize: 'auto' | number;
  /** See `InpaintConfig.invertMask`. */
  invertMask: boolean;
  /** Filenames used when uploading to ComfyUI's input/ folder. */
  baseName: string;
};

export async function queuePrompt(
  host: string,
  workflow: WorkflowState,
  layers: Layer[],
  /** Pre-uploaded input-image ref from `uploadInputImage(host, workflow)`.
   *  When omitted, queuePrompt uploads itself (the common path). Pass it to
   *  skip a redundant re-encode/upload when you already have one. */
  preUploadedRef?: string | null,
  /** Inpaint source from the canvas capture. When set, both composite and
   *  mask are uploaded fresh per server and `workflow.inputImage` is
   *  ignored — the composite becomes the input image, the mask scopes the
   *  change to the target layer's area. */
  inpaintSource?: InpaintSource | null,
): Promise<QueueResult> {
  if (!workflow.checkpoints[0]?.name) return { ok: false, error: 'Pick a checkpoint first' };
  const positive = compileLayers(layers, 'positive');
  const negative = compileLayers(layers, 'negative');

  let inputImageRef: string | null = preUploadedRef ?? null;
  let inpaintConfig: InpaintConfig | null = null;

  if (inpaintSource) {
    // Inpaint path: upload composite + mask, ignore workflow.inputImage.
    try {
      const compUp = await uploadImage(host, inpaintSource.composite, `${inpaintSource.baseName}-ctx.png`);
      const maskUp = await uploadImage(host, inpaintSource.mask, `${inpaintSource.baseName}-mask.png`);
      inputImageRef = loadImageRef(compUp);
      inpaintConfig = {
        maskRef: loadImageRef(maskUp),
        variant: inpaintSource.variant,
        blendPx: inpaintSource.blendPx,
        maskExpand: inpaintSource.maskExpand,
        controlnet: inpaintSource.controlnet,
        contextExtend: inpaintSource.contextExtend,
        targetSize: inpaintSource.targetSize,
        invertMask: inpaintSource.invertMask,
      };
    } catch (err) {
      return { ok: false, error: `Inpaint upload failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  } else if (!inputImageRef && workflow.inputImage) {
    try {
      inputImageRef = await uploadInputImage(host, workflow);
    } catch (err) {
      return { ok: false, error: `Input image upload failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  try {
    const built = buildGraph(workflow, layers, inputImageRef, inpaintConfig);
    const { graph, clampNotes } = built;
    const res = await fetch(`${comfyHttpFor(host)}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: graph, client_id: clientId }),
    });
    const json = await res.json();
    if (json.error) {
      return { ok: false, error: json.error.message || JSON.stringify(json.error) };
    }
    if (json.prompt_id) {
      return { ok: true, promptId: json.prompt_id, positive, negative, nodeCount: Object.keys(graph).length, clampNotes };
    }
    return { ok: false, error: 'Queue rejected' };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchPromptResult(
  host: string,
  promptId: string,
  meta: {
    positive: string;
    negative: string;
    seed: number;
    model: string;
    /** Optional snapshots — when present they ride along into the history entry. */
    workflow?: WorkflowState;
    layers?: Layer[];
  },
): Promise<{ url: string; entry: HistoryEntry } | { error: string }> {
  try {
    const res = await fetch(`${comfyHttpFor(host)}/history/${promptId}`);
    const hist = await res.json();
    const entry = hist[promptId];
    if (!entry) return { error: 'No history for prompt' };
    if (entry.status?.status_str === 'error') {
      const failure = entry.status.messages?.find(([type]: [string, unknown]) => type === 'execution_error' || type === 'execution_interrupted');
      return { error: failure?.[1]?.exception_message || 'Generation interrupted or failed' };
    }
    for (const out of Object.values(entry.outputs || {}) as Array<{ images?: Array<{ filename: string; subfolder?: string; type?: string }> }>) {
      if (out.images && out.images.length) {
        const img = out.images[0];
        const url = viewUrl(img, host);
        const historyEntry: HistoryEntry = {
          id: uid(),
          serverId: '', // stamped by the caller with the job's server id
          filename: img.filename,
          subfolder: img.subfolder || '',
          type: img.type || 'output',
          promptId,
          positive: meta.positive,
          negative: meta.negative,
          seed: meta.seed,
          model: meta.model,
          createdAt: Date.now(),
          workflow: meta.workflow,
          layers: meta.layers,
        };
        return { url, entry: historyEntry };
      }
    }
    return { error: 'No image in output' };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Snapshot of a ComfyUI server's live queue — the prompt ids currently running
 * and those still pending. Used to reconcile persisted jobs after a refresh.
 */
export async function fetchQueue(host: string): Promise<{ running: string[]; pending: string[] }> {
  const res = await fetch(`${comfyHttpFor(host)}/queue`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Each queue item is shaped [number, prompt_id, graph, extra, ...].
  const ids = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.map(e => (Array.isArray(e) ? String(e[1] ?? '') : '')).filter(Boolean)
      : [];
  return { running: ids(json.queue_running), pending: ids(json.queue_pending) };
}

/** Interrupt whatever prompt is currently executing on a ComfyUI server. */
export async function interruptPrompt(host: string): Promise<void> {
  await fetch(`${comfyHttpFor(host)}/interrupt`, { method: 'POST' });
}

/** Remove a still-pending prompt from a ComfyUI server's queue by id. */
export async function deleteQueuedPrompt(host: string, promptId: string): Promise<void> {
  await fetch(`${comfyHttpFor(host)}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: [promptId] }),
  });
}

/**
 * Pull the most recently *run* workflow back out of a ComfyUI server.
 * ComfyUI's `/history` stores each run as `prompt: [number, prompt_id, graph,
 * extra, ...]` where `graph` is the API-format prompt graph.
 */
export async function fetchLastWorkflow(host: string): Promise<
  | { ok: true; json: string; promptId: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${comfyHttpFor(host)}/history?max_items=1`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const hist = await res.json() as Record<string, { prompt?: unknown[] }>;
    const ids = Object.keys(hist);
    if (!ids.length) {
      return { ok: false, error: 'No runs in this ComfyUI history yet — queue a workflow there first.' };
    }
    const entry = hist[ids[ids.length - 1]];
    const graph = entry?.prompt?.[2];
    if (!graph || typeof graph !== 'object') {
      return { ok: false, error: 'Latest history entry has no prompt graph.' };
    }
    return { ok: true, json: JSON.stringify(graph, null, 2), promptId: ids[ids.length - 1] };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type WsEvent =
  | { type: 'binary'; mime: string; bytes: Uint8Array }
  | { type: 'progress'; value: number; max: number; promptId: string }
  | { type: 'executing'; promptId: string; node: string | null }
  | { type: 'execution_error'; message: string; promptId: string };

/**
 * Connect to a ComfyUI server's websocket. Auto-reconnects every 2s on close.
 * `onOpen`/`onClose` fire on connection state changes; `onEvent` for messages.
 * Returns a cleanup function that closes the socket and stops reconnecting.
 */
export function connectComfyWs(host: string, handlers: {
  onOpen?: () => void;
  onClose?: () => void;
  onEvent: (ev: WsEvent) => void;
}): () => void {
  // Now a thin adapter over the shared bus. It used to open its own socket, which meant a second
  // caller on the same host displaced this one inside ComfyUI — only one socket per clientId
  // survives there. The bus owns the connection; this narrows the bus's richer event set down to
  // the four cases the generate view's store already knows how to handle.
  return subscribeComfy(host, {
    onOpen: handlers.onOpen,
    onClose: handlers.onClose,
    onEvent: (ev) => {
      switch (ev.type) {
        case 'binary':
          return handlers.onEvent({ type: 'binary', mime: ev.mime, bytes: ev.bytes });
        case 'progress':
          return handlers.onEvent({ type: 'progress', value: ev.value, max: ev.max, promptId: ev.promptId });
        case 'executing':
          return handlers.onEvent({ type: 'executing', promptId: ev.promptId, node: ev.node });
        case 'execution_success':
          return handlers.onEvent({ type: 'executing', promptId: ev.promptId, node: null });
        case 'execution_error':
          return handlers.onEvent({ type: 'execution_error', message: ev.message, promptId: ev.promptId });
        default:
          return;   // execution_start / cached / executed / status are Studio's, not this view's
      }
    },
  });
}

// ─── Studio: saved workflows and raw-graph submission ───────────────────────
//
// The generate view builds one fixed graph out of WorkflowState. Studio does the opposite: it
// takes whatever workflow the person built in ComfyUI and submits that. These are the two ends
// of that path, kept here so every fetch to a ComfyUI host still goes through one module.

/** One saved workflow as ComfyUI's userdata API lists it. */
export interface SavedWorkflow {
  /** Path under the workflows dir, e.g. `portrait.json` or `wip/portrait.json`. */
  path: string;
  /** Leaf name without the extension — what the ComfyUI tab is called. */
  name: string;
  /** Epoch ms of the last save, when the server reports it. Drives change detection. */
  modified: number;
}

/**
 * List the workflows saved in ComfyUI on this host.
 *
 * ComfyUI writes every saved workflow under its `userdata` store, which is the only place the
 * running editor's work is readable from outside the browser tab. Polling this is what makes
 * "build it in ComfyUI and it shows up here" true without ComfyUI having to tell us anything.
 *
 * An empty list is a normal answer: the endpoint 404s with "Directory not found" until the person
 * saves for the first time, so that case is not an error.
 */
export async function listSavedWorkflows(host: string): Promise<SavedWorkflow[]> {
  const url = `${comfyHttpFor(host)}/api/userdata?dir=workflows&recurse=true&full_info=true`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: unknown) => {
      // full_info=true gives objects; without it the API returns bare strings. Accept both so a
      // slightly older ComfyUI still lists.
      const path = typeof r === 'string' ? r : String((r as { path?: string }).path ?? '');
      const modified = typeof r === 'string' ? 0 : Number((r as { modified?: number }).modified ?? 0);
      return { path, name: path.replace(/^.*\//, '').replace(/\.json$/i, ''), modified };
    })
    .filter(w => w.path.toLowerCase().endsWith('.json'))
    .sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
}

/** Fetch one saved workflow's editor JSON. `path` is as `listSavedWorkflows` reported it. */
export async function loadSavedWorkflow(host: string, path: string): Promise<unknown> {
  // The userdata file API takes the whole path as ONE encoded segment — the slash inside it must
  // stay escaped or the server reads it as a directory boundary and 404s.
  const id = encodeURIComponent(`workflows/${path}`);
  const res = await fetch(`${comfyHttpFor(host)}/api/userdata/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Submit an already-built API graph. The generate view's `queuePrompt` owns compiling prompts and
 * uploading images; Studio has a graph already and needs none of that, so this is the thin path.
 * It reuses `clientId` so the existing websocket sees progress for these jobs too.
 */
export async function queueGraph(
  host: string,
  graph: Record<string, unknown>,
): Promise<{ ok: true; promptId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${comfyHttpFor(host)}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: graph, client_id: clientId }),
    });
    const json = await res.json();
    if (json.error) {
      // ComfyUI reports a bad graph as {error, node_errors}. The node errors say which widget is
      // wrong, which is exactly what a person tuning exposed params needs to see.
      const detail = json.node_errors && Object.keys(json.node_errors).length
        ? ` (${Object.entries(json.node_errors as Record<string, { errors?: { message?: string }[] }>)
            .map(([id, e]) => `node ${id}: ${e.errors?.[0]?.message ?? 'invalid'}`).join('; ')})`
        : '';
      return { ok: false, error: (json.error.message || JSON.stringify(json.error)) + detail };
    }
    if (json.prompt_id) return { ok: true, promptId: json.prompt_id };
    return { ok: false, error: 'Queue rejected' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
