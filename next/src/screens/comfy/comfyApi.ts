/**
 * The three ComfyUI calls the ComfyUI screen needs that `@/lib/comfy.ts` does not have yet
 * (`/system_stats`, the full `/queue` with graphs, writing a workflow file). Host addressing comes
 * from `@/lib/comfy` like every other call; queue cancel/interrupt and the workflow list are reused
 * from there as is.
 */
import { comfyHttpFor } from '@/lib/comfy';

const TIMEOUT_MS = 8000;

/** `GET /system_stats` (GPU, VRAM, ComfyUI version). Throws when the server does not answer. */
export async function fetchSystemStats(host: string): Promise<unknown> {
  const res = await fetch(`${comfyHttpFor(host)}/system_stats`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** `GET /queue` as ComfyUI sends it (running + pending, each with its graph). */
export async function fetchQueueRaw(host: string): Promise<unknown> {
  const res = await fetch(`${comfyHttpFor(host)}/queue`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Save a workflow under ComfyUI's `workflows/` folder (the same store ComfyUI's own Save writes,
 * so it shows in the editor's workflow list too). Refuses to overwrite: a 409 throws "exists".
 */
export async function saveWorkflowFile(host: string, fileName: string, workflow: unknown): Promise<void> {
  const id = encodeURIComponent(`workflows/${fileName}`);
  const res = await fetch(`${comfyHttpFor(host)}/api/userdata/${id}?overwrite=false&full_info=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (res.status === 409) throw new Error('exists');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** The URL of the server's own ComfyUI page (embedded on desktop, opened in a tab on phones). */
export function comfyPageUrl(host: string): string {
  return `${comfyHttpFor(host)}/`;
}

/** Delete a saved workflow file (path under `workflows/`). A missing file counts as deleted. */
export async function deleteWorkflowFile(host: string, path: string): Promise<void> {
  const id = encodeURIComponent(`workflows/${path}`);
  const res = await fetch(`${comfyHttpFor(host)}/api/userdata/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
}

/** Write a workflow file back at its exact path (overwrite allowed): Undo after a delete. */
export async function restoreWorkflowFile(host: string, path: string, workflow: unknown): Promise<void> {
  const id = encodeURIComponent(`workflows/${path}`);
  const res = await fetch(`${comfyHttpFor(host)}/api/userdata/${id}?overwrite=true&full_info=true`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
