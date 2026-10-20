/**
 * Every mode's results as one shape (`ResultItem`), so the hero and the strip are the same blocks
 * everywhere. Images come from the generate history (with the entry attached, so favourite / send
 * to canvas / delete still work); video and workflow results come from their run stores.
 */
import { useMemo } from 'react';
import type { RunResult } from '@/lib/comfyRunner';
import { viewUrl } from '@/lib/comfyHost';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { isVideoFile, type ResultItem } from '@/lib/workspace';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useVideoRun } from '@/features/video/videoRun';

export type ImageResultItem = ResultItem & { entry: HistoryEntry };

const NONE: ImageResultItem[] = [];

export function useImageResults(): ImageResultItem[] {
  const history = useStore(s => s.history);
  const servers = useStore(s => s.servers);
  return useMemo(() => {
    const items: ImageResultItem[] = [];
    for (const e of history) {
      const host = servers.find(s => s.id === e.serverId)?.host;
      if (!host) continue;
      items.push({ key: e.id, url: viewUrl(e, host), kind: 'image', filename: e.filename, createdAt: e.createdAt, durationMs: e.durationMs, entry: e });
    }
    return items.length ? items : NONE;
  }, [history, servers]);
}

export const toResultItem = (r: RunResult): ResultItem => ({
  key: r.url, url: r.url, kind: isVideoFile(r.filename) ? 'video' : 'image', filename: r.filename, createdAt: r.createdAt, durationMs: r.durationMs,
});

export function useVideoResults(): ResultItem[] {
  const results = useVideoRun(s => s.results);
  return useMemo(() => results.map(toResultItem), [results]);
}

export function useWorkflowResults(): ResultItem[] {
  const results = useWorkflowRun(s => s.results);
  return useMemo(() => results.map(toResultItem), [results]);
}
