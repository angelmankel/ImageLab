/**
 * The files each server's ImageLab node has not hashed yet (ImageLabCore 825f446: `/hashes`
 * answers `pending` + `progress`), kept apart from `modelHashes` on purpose — a pending entry has
 * no hash and must never reach the hash list, the installed index or the CivitAI lookup. Per
 * server (by host), filled by `useModelHashes`; older nodes send neither field and leave nothing
 * here. The pure parts (`mergeProgress`, `hashStateFor`) are tested in tests/hash-pending.test.cjs.
 */
import { create } from 'zustand';
import type { ModelHash, ModelHashPending, ModelHashProgress } from './comfy';
import { findModelHash } from './modelHash';

interface HashPendingState {
  byHost: Record<string, { pending: ModelHashPending[]; progress?: ModelHashProgress }>;
  set: (host: string, pending: ModelHashPending[] | undefined, progress: ModelHashProgress | undefined) => void;
}

export const useHashPending = create<HashPendingState>((set) => ({
  byHost: {},
  set: (host, pending, progress) => set((s) => ({ byHost: { ...s.byHost, [host]: { pending: pending ?? [], progress } } })),
}));

/** Only real hash entries: a string hash (an older / odd node could send an entry without one). */
export function withHash(models: readonly ModelHash[] | null | undefined): ModelHash[] {
  return (models ?? []).filter((m) => !!m && typeof m.hash === 'string' && m.hash.length > 0);
}

/** Every server's progress summed; undefined when no server reports any (older nodes). */
export function mergeProgress(list: readonly (ModelHashProgress | undefined)[]): ModelHashProgress | undefined {
  const have = list.filter((p): p is ModelHashProgress => !!p);
  if (!have.length) return undefined;
  return {
    hashed: have.reduce((n, p) => n + (p.hashed || 0), 0),
    total: have.reduce((n, p) => n + (p.total || 0), 0),
    pending: have.reduce((n, p) => n + (p.pending || 0), 0),
    ready: have.every((p) => p.ready !== false),
  };
}

/**
 * A file's hashing state, matched like `findModelHash` (path, file name, an embedding's stem).
 * A file that is already hashed somewhere is not pending.
 */
export function hashStateFor(pending: readonly ModelHashPending[], hashes: readonly ModelHash[], fileName: string): ModelHashPending['state'] | undefined {
  if (!fileName || !pending.length) return undefined;
  if (findModelHash(hashes, fileName)) return undefined;
  return findModelHash(pending, fileName)?.state;
}

const NONE: ModelHashPending[] = [];
let lastByHost: HashPendingState['byHost'] | null = null;
let lastAll: ModelHashPending[] = NONE;
/** All servers' pending files in one list (stable while nothing changed). */
export function allPending(byHost: HashPendingState['byHost']): ModelHashPending[] {
  if (byHost === lastByHost) return lastAll;
  lastByHost = byHost;
  const all = Object.values(byHost).flatMap((v) => v.pending);
  lastAll = all.length ? all : NONE;
  return lastAll;
}
