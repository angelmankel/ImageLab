/**
 * The model kinds the list component knows (rule 4: one component for Checkpoint · LoRAs ·
 * Embeds · ControlNet) and one hook that reads each kind's entries from the main app's workflow
 * (`@/lib/store`) and writes back through its actions. The components never touch the store
 * directly for entries: they go through `useKindApi`.
 */
import { useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { WorkflowEmbedding } from '@/lib/types';
import { useControlnets, type ControlNetEntry } from './controlnetStore';

export type ModelKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet';

export const ALL_KINDS: readonly ModelKind[] = ['checkpoint', 'lora', 'embedding', 'controlnet'];

export interface KindSpec {
  key: ModelKind;
  /** The tab label. */
  label: string;
  /** "a LoRA" — for empty hints and the picker title. */
  one: string;
  /** The main slider under the entry. */
  weight: { label: string; min: number; max: number; step: number; presets: number[] };
  /** The entry can be switched off without being removed. */
  hasSwitch: boolean;
  /** Which `ServerInfo` list offers the files. */
  list: 'models' | 'loras' | 'embeddings' | 'controlnets';
}

export const KINDS: Record<ModelKind, KindSpec> = {
  checkpoint: { key: 'checkpoint', label: 'Checkpoint', one: 'checkpoint', weight: { label: 'Merge ratio', min: 0, max: 1, step: 0.01, presets: [0.25, 0.5, 0.75] }, hasSwitch: false, list: 'models' },
  lora: { key: 'lora', label: 'LoRAs', one: 'LoRA', weight: { label: 'Strength', min: 0, max: 2, step: 0.05, presets: [0.5, 0.8, 1, 1.2] }, hasSwitch: true, list: 'loras' },
  embedding: { key: 'embedding', label: 'Embeds', one: 'embedding', weight: { label: 'Strength', min: 0, max: 2, step: 0.05, presets: [0.5, 0.8, 1, 1.2] }, hasSwitch: true, list: 'embeddings' },
  controlnet: { key: 'controlnet', label: 'ControlNet', one: 'ControlNet', weight: { label: 'Strength', min: 0, max: 2, step: 0.05, presets: [0.5, 0.8, 1, 1.2] }, hasSwitch: true, list: 'controlnets' },
};

/** One row of the list, whatever the kind. */
export interface ModelEntry {
  id: string;
  name: string;
  on: boolean;
  /** The main weight: merge ratio, LoRA strength, embedding strength, ControlNet strength. */
  weight: number;
  /** Shown instead of the weight on the circle (the base checkpoint). */
  badge?: string;
  /** The base checkpoint: no ratio, carries the VAE and the model type. */
  isBase?: boolean;
}

export interface KindApi {
  kind: ModelKind;
  spec: KindSpec;
  entries: ModelEntry[];
  /** Every file of this kind the servers offer. */
  files: string[];
  /** Adds one and returns its id. */
  add: (name: string) => string | undefined;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setOn: (id: string, on: boolean) => void;
  setWeight: (id: string, v: number) => void;
}

const NO_EMBEDDINGS: WorkflowEmbedding[] = Object.freeze([]) as unknown as WorkflowEmbedding[];

/** Subscribes to every kind's slice (hooks must not branch) and returns the api for `kind`. */
export function useKindApi(kind: ModelKind): KindApi {
  const checkpoints = useStore((s) => s.workflow.checkpoints);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings) ?? NO_EMBEDDINGS;
  const controlnets = useControlnets((s) => s.entries);
  const server = useStore((s) => s.server);
  const cn = useControlnets;

  const entries = useMemo<ModelEntry[]>(() => {
    switch (kind) {
      case 'checkpoint':
        return checkpoints.map((c, i) => ({ id: c.id, name: c.name, on: true, weight: c.ratio, isBase: i === 0, badge: i === 0 && checkpoints.length > 1 ? 'Base' : undefined }));
      case 'lora':
        return loras.map((l) => ({ id: l.id, name: l.name, on: l.on, weight: l.strength }));
      case 'embedding':
        return embeddings.map((e) => ({ id: e.id, name: e.name, on: e.on, weight: e.strength }));
      case 'controlnet':
        return controlnets.map((c: ControlNetEntry) => ({ id: c.id, name: c.name, on: c.on, weight: c.strength }));
    }
  }, [kind, checkpoints, loras, embeddings, controlnets]);

  const files = server[KINDS[kind].list];

  const add = useCallback((name: string) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': st.addCheckpoint(name); return useStore.getState().workflow.checkpoints.at(-1)?.id;
      case 'lora': st.addLora(name); return useStore.getState().workflow.loras.at(-1)?.id;
      case 'embedding': st.addEmbedding(name); return useStore.getState().workflow.embeddings?.at(-1)?.id;
      case 'controlnet': return cn.getState().add(name);
    }
  }, [kind, cn]);

  const remove = useCallback((id: string) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.removeCheckpoint(id);
      case 'lora': return st.removeLora(id);
      case 'embedding': return st.removeEmbedding(id);
      case 'controlnet': return cn.getState().remove(id);
    }
  }, [kind, cn]);

  const rename = useCallback((id: string, name: string) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.updateCheckpoint(id, { name });
      case 'lora': return st.updateLora(id, { name });
      case 'embedding': return st.updateEmbedding(id, { name });
      case 'controlnet': return cn.getState().update(id, { name });
    }
  }, [kind, cn]);

  const setOn = useCallback((id: string, on: boolean) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return; // a checkpoint is either in the merge or removed
      case 'lora': return st.updateLora(id, { on });
      case 'embedding': return st.updateEmbedding(id, { on });
      case 'controlnet': return cn.getState().update(id, { on });
    }
  }, [kind, cn]);

  const setWeight = useCallback((id: string, v: number) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.updateCheckpoint(id, { ratio: v });
      case 'lora': return st.updateLora(id, { strength: v });
      case 'embedding': return st.updateEmbedding(id, { strength: v });
      case 'controlnet': return cn.getState().update(id, { strength: v });
    }
  }, [kind, cn]);

  return { kind, spec: KINDS[kind], entries, files, add, remove, rename, setOn, setWeight };
}

/** A short weight for the circle badge: 0.8, 1, 1.25. */
export function fmtWeight(v: number): string {
  return String(Number(v.toFixed(2)));
}
