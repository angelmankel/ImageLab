/**
 * Pending → installed (models-picker brief, item 5), for every step's store. Watches the servers'
 * lists: when a pending record's file appears, every registered pending scope (`pendingScopes.ts`:
 * the Image workflow, the Video store, a Workflow step's widgets) renames its waiting entries to
 * the name the server lists and switches them back to the user's choice; a pending Image
 * checkpoint joins `workflow.checkpoints` at its ratio; then the record is dropped. A record whose
 * own scope no longer has its entry is dropped too. Mounted once near the app root (AppEffects);
 * `PendingPoller` keeps the download manager polling while anything is pending.
 */
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useDownloads } from '@/hooks/useDownloads';
import { useControlnets } from './controlnetStore';
import { usePendingModels } from './pendingModels';
import { reconcile } from './pendingLogic';
import { pendingScopes, scopeOf } from './pendingScopes';

export function usePendingReconcile() {
  const records = usePendingModels((s) => s.records);
  const server = useStore((s) => s.server);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings);
  const controlnets = useControlnets((s) => s.entries);

  useEffect(() => {
    const all = Object.values(records);
    if (!all.length) return;
    const scopes = pendingScopes();
    const pm = usePendingModels.getState();
    // A record whose own scope says its entry is gone is stale; an unregistered scope keeps it.
    const live = all.filter((r) => { const sc = scopes.get(scopeOf(r)); const ok = !sc || sc.has(r); if (!ok) pm.remove(r.key); return ok; });
    const lists = {
      checkpoint: server.models, lora: server.loras, embedding: server.embeddings, controlnet: server.controlnets,
      vae: server.vaes, clip: server.textEncoders, upscale: server.upscaleModels, other: server.models,
      models: server.models, diffusionModels: server.diffusionModels, loras: server.loras, embeddings: server.embeddings,
      controlnets: server.controlnets, vaes: server.vaes, textEncoders: server.textEncoders, upscaleModels: server.upscaleModels,
    };
    const { landed } = reconcile(live, lists);
    for (const { record, file } of landed) {
      for (const sc of scopes.values()) sc.land(record, file);
      pm.remove(record.key);
    }
  }, [records, server, loras, embeddings, controlnets]);
}

/** Render while any model is pending: polls the download manager (progress + the capability refresh on completion). */
export function PendingPoller() {
  useDownloads();
  return null;
}
