/**
 * Cancel from the ComfyUI screen's queue (rule 15: every job can be cancelled). A prompt this app
 * queued itself is a job in `@/lib/store`: its own `cancelJob` interrupts or dequeues it AND drops
 * it from the app's queue. Anything else (queued from ComfyUI, another tab) goes straight to
 * ComfyUI through the existing `interruptPrompt` / `deleteQueuedPrompt`.
 */
import { deleteQueuedPrompt, interruptPrompt } from '@/lib/comfy';
import { useStore } from '@/lib/store';
import type { QueueRow } from './comfyHelpers';

export async function cancelRow(host: string, row: QueueRow): Promise<void> {
  const job = useStore.getState().jobs.find((j) => j.id === row.id);
  if (job) { useStore.getState().cancelJob(job.id); return; }
  if (row.state === 'running') await interruptPrompt(host);
  else await deleteQueuedPrompt(host, row.id);
}

/** Drop every pending prompt (the running one keeps going; its own ✕ stops it). */
export async function clearPending(host: string, rows: readonly QueueRow[]): Promise<void> {
  await Promise.allSettled(rows.filter((r) => r.state === 'pending').map((r) => cancelRow(host, r)));
}
