/**
 * What step 1 (the Image step) holds per model kind, as "Use same models as step 1" (fix list
 * item 40) reads it: the main app's workflow (checkpoints, LoRAs, embeddings, VAE) and the
 * ControlNet store. A file still downloading (a pending record) is left out: the steps that follow
 * cannot load it yet. `useStep1Source` is the same list, re-read when any of it changes.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useControlnets } from './controlnetStore';
import { usePendingModels } from './pendingModels';
import { pendingKey } from './pendingLogic';
import type { ModelKind } from './kindSpecs';
import type { SourceEntry } from './followLogic';

export function step1Source(kind: ModelKind): SourceEntry[] {
  const w = useStore.getState().workflow;
  const records = usePendingModels.getState().records;
  const ready = (name: string) => !!name && !records[pendingKey(kind, name)];
  switch (kind) {
    case 'checkpoint': return w.checkpoints.filter((c) => ready(c.name)).map((c) => ({ name: c.name, on: true, weight: c.ratio }));
    case 'lora': return w.loras.filter((l) => ready(l.name)).map((l) => ({ name: l.name, on: l.on, weight: l.strength }));
    case 'embedding': return (w.embeddings ?? []).filter((e) => ready(e.name)).map((e) => ({ name: e.name, on: e.on, weight: e.strength }));
    case 'controlnet': return useControlnets.getState().entries.filter((c) => ready(c.name)).map((c) => ({ name: c.name, on: c.on, weight: c.strength }));
    case 'vae': return w.vae ? [{ name: w.vae, on: true, weight: 1 }] : [];
    default: return [];
  }
}

/** `step1Source(kind)`, live. */
export function useStep1Source(kind: ModelKind): SourceEntry[] {
  const checkpoints = useStore((s) => s.workflow.checkpoints);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings);
  const vae = useStore((s) => s.workflow.vae);
  const controlnets = useControlnets((s) => s.entries);
  const records = usePendingModels((s) => s.records);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => step1Source(kind), [kind, checkpoints, loras, embeddings, vae, controlnets, records]);
}
