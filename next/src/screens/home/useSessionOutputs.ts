/**
 * Each session's last output and output count (fix list 20: the Home tile's picture; 36: the tab's
 * thumbnail). A result belongs to the session that owns the step it is tagged with
 * (`resultSteps.ts`); untagged old results belong to the migrated session (`lastOutputOf`).
 */
import { useMemo } from 'react';
import type { ResultItem } from '@/lib/workspace';
import { useImageResults, useVideoResults, useWorkflowResults } from '@/features/workspace/results';
import { useSessions } from '~/app/sessionsStore';
import { countOutputs, lastOutputOf } from '~/app/sessionsLogic';
import { useResultSteps } from '~/screens/image/resultSteps';

export interface SessionOutput { last: ResultItem | null; count: number }

export function useSessionOutputs(): Record<string, SessionOutput> {
  const images = useImageResults();
  const videos = useVideoResults();
  const runs = useWorkflowResults();
  const tags = useResultSteps((s) => s.tags);
  const sessions = useSessions((s) => s.sessions);
  return useMemo(() => {
    const all: ResultItem[] = [...images, ...videos, ...runs];
    const out: Record<string, SessionOutput> = {};
    for (const s of Object.values(sessions)) out[s.id] = { last: lastOutputOf(s, tags, all), count: countOutputs(s, tags, all) };
    return out;
  }, [images, videos, runs, tags, sessions]);
}
