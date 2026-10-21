/**
 * The ImageLab node's hashing, as the next UI shows it (ImageLabCore 825f446): a file still
 * waiting / being hashed / failed reads "Hashing…" (not "unknown" / "Not on CivitAI"), and the
 * Models browser shows "Hashing models 140 / 146" while any server is busy. Data: `@/lib/hashPending`
 * (per server, filled by `useModelHashes`); older nodes send nothing and nothing shows.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { ModelHashPending, ModelHashProgress } from '@/lib/comfy';
import { allPending, hashStateFor, mergeProgress, useHashPending } from '@/lib/hashPending';

export function useHashState(file: string | null | undefined): ModelHashPending['state'] | undefined {
  const byHost = useHashPending((s) => s.byHost);
  const hashes = useStore((s) => s.modelHashes);
  return useMemo(() => (file ? hashStateFor(allPending(byHost), hashes, file) : undefined), [byHost, hashes, file]);
}

export function useHashProgress(): ModelHashProgress | undefined {
  const byHost = useHashPending((s) => s.byHost);
  return useMemo(() => mergeProgress(Object.values(byHost).map((v) => v.progress)), [byHost]);
}

export function hashLabel(state: ModelHashPending['state']): string {
  return state === 'hashing' ? 'Hashing…' : state === 'queued' ? 'Waiting to hash' : 'Hash failed';
}
