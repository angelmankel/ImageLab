/**
 * Pending (picked, not yet downloaded) models — persisted, next-only, keyed by kind + file name
 * (`pendingLogic.pendingKey`). `usePendingReconcile` drops a record the moment a server lists its
 * file and turns it into a real, enabled entry.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PendingRecord } from './pendingLogic';

interface PendingState {
  records: Record<string, PendingRecord>;
  add: (r: PendingRecord) => void;
  update: (key: string, patch: Partial<PendingRecord>) => void;
  remove: (key: string) => void;
}

export const usePendingModels = create<PendingState>()(
  persist(
    (set) => ({
      records: {},
      add: (r) => set((s) => ({ records: { ...s.records, [r.key]: r } })),
      update: (key, patch) => set((s) => (s.records[key] ? { records: { ...s.records, [key]: { ...s.records[key], ...patch } } } : s)),
      remove: (key) => set((s) => { if (!s.records[key]) return s; const records = { ...s.records }; delete records[key]; return { records }; }),
    }),
    { name: 'imagelab.next.pendingModels.v1' },
  ),
);
