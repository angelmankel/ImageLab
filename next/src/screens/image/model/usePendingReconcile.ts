/**
 * Pending → installed (models-picker brief, item 5). Watches the servers' lists: when a pending
 * record's file appears, the waiting LoRA / embedding / ControlNet entry is renamed to the name
 * the server lists and switched back to the user's choice, a pending checkpoint joins
 * `workflow.checkpoints` at its ratio, and the record is dropped. Records whose entry was removed
 * elsewhere are dropped too. Mount once near the app root (the Model tab mounts it as well; it
 * is idempotent). `PendingPoller` keeps the download manager polling while anything is pending.
 */
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useDownloads } from '@/hooks/useDownloads';
import { useControlnets } from './controlnetStore';
import { usePendingModels } from './pendingModels';
import { reconcile, type PendingRecord } from './pendingLogic';

export function usePendingReconcile() {
  const records = usePendingModels((s) => s.records);
  const server = useStore((s) => s.server);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings);
  const controlnets = useControlnets((s) => s.entries);

  useEffect(() => {
    const all = Object.values(records);
    if (!all.length) return;
    const hasEntry = (r: PendingRecord) =>
      r.kind === 'checkpoint' ? true
      : r.kind === 'lora' ? loras.some((l) => l.id === r.entryId)
      : r.kind === 'embedding' ? (embeddings ?? []).some((e) => e.id === r.entryId)
      : controlnets.some((c) => c.id === r.entryId);
    const pm = usePendingModels.getState();
    const live = all.filter((r) => { const ok = hasEntry(r); if (!ok) pm.remove(r.key); return ok; });
    const { landed } = reconcile(live, { checkpoint: server.models, lora: server.loras, embedding: server.embeddings, controlnet: server.controlnets });
    for (const { record, file } of landed) {
      const st = useStore.getState();
      switch (record.kind) {
        case 'checkpoint': {
          st.addCheckpoint(file);
          const id = useStore.getState().workflow.checkpoints.at(-1)?.id;
          if (id) st.updateCheckpoint(id, { ratio: record.weight });
          break;
        }
        case 'lora': st.updateLora(record.entryId!, { name: file, on: record.userOn }); break;
        case 'embedding': st.updateEmbedding(record.entryId!, { name: file, on: record.userOn }); break;
        case 'controlnet': useControlnets.getState().update(record.entryId!, { name: file, on: record.userOn }); break;
      }
      pm.remove(record.key);
    }
  }, [records, server, loras, embeddings, controlnets]);
}

/** Render while any model is pending: polls the download manager (progress + the capability refresh on completion). */
export function PendingPoller() {
  useDownloads();
  return null;
}
