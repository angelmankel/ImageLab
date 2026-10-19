/**
 * Which server a workspace mode runs on.
 *
 * Images are routed per job by the generate store (round-robin or pinned, minus video-only
 * servers). Video and Workflow run on one host each: the pinned server when it fits the mode, else
 * the first that does — a dedicated video ComfyUI for video (`lib/serverRoles.ts`).
 */
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { pickServerForMode } from '@/lib/serverRoles';
import type { WorkspaceMode } from '@/lib/workspace';

export function useModeHost(mode: WorkspaceMode): string | null {
  const servers = useStore(s => s.servers);
  const pinned = useCanvasStore(s => s.comfyServerId);
  return pickServerForMode(servers, mode, pinned)?.host ?? null;
}

/** `useModeHost` outside React. */
export function modeHostNow(mode: WorkspaceMode): string | null {
  return pickServerForMode(useStore.getState().servers, mode, useCanvasStore.getState().comfyServerId)?.host ?? null;
}
