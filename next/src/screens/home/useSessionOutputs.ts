/**
 * Each session's last output and output count (fix list 20: the Home tile's picture; 36: the tab's
 * thumbnail). A result belongs to the session that owns it (`~/app/outputs`, fix list 2 item 9):
 * its owner record, else its step's session, else the Unsorted session.
 */
import { useMemo } from 'react';
import type { ResultItem } from '@/lib/workspace';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useSessions } from '~/app/sessionsStore';
import { sessionOf, useOwnerCtx } from '~/app/outputs';

export interface SessionOutput { last: ResultItem | null; count: number }

export function useSessionOutputs(): Record<string, SessionOutput> {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const ctx = useOwnerCtx();
  const sessions = useSessions((s) => s.sessions);
  return useMemo(() => {
    const out: Record<string, SessionOutput> = {};
    for (const id of Object.keys(sessions)) out[id] = { last: null, count: 0 };
    for (const r of [...images, ...videos, ...runs] as ResultItem[]) {
      const id = sessionOf(r.key, ctx);
      const o = id ? out[id] : undefined;
      if (!o) continue;
      o.count++;
      if (!o.last || r.createdAt > o.last.createdAt) o.last = r;
    }
    return out;
  }, [images, videos, runs, ctx, sessions]);
}
