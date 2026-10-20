/**
 * The Image step's `KindApi` (rule 4): one hook that reads each kind's entries from the main
 * app's workflow (`@/lib/store`) and writes back through its actions. The components never touch
 * the store directly for entries: they go through this api (other steps hand `ModelList` their
 * own — see `kindApi.ts`). The kind vocabulary itself is `kindSpecs.ts`.
 *
 * Pending models (picked before they are downloaded — models-picker brief, item 5) are records in
 * `pendingModels.ts`: a LoRA / embedding / ControlNet gets its store entry at once, switched OFF
 * so the graph never loads a missing file (the user's On/Off lives on the record meanwhile); a
 * checkpoint has no off switch, so a pending one is the record alone until it lands.
 */
import { useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { WorkflowEmbedding } from '@/lib/types';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { bucketFits } from '@/lib/modelProfiles';
import type { BaseModelBucket } from '@/lib/modelHash';
import { useControlnets, type ControlNetEntry } from './controlnetStore';
import { usePendingModels } from './pendingModels';
import { expectedFileName, pendingKey, recordFromPick, sameFile, type PickLike } from './pendingLogic';
import { KINDS, type ModelEntry, type ModelKind } from './kindSpecs';
import type { KindApi } from './kindApi';
import { IMAGE_SCOPE, registerPendingScope } from './pendingScopes';
import { imageCardParts } from './imageCard';

export { KINDS, ALL_KINDS, IMAGE_KINDS, fmtWeight, specWith, type ModelKind, type ModelEntry, type KindSpec, type PickKind } from './kindSpecs';
export type { KindApi, CardParts } from './kindApi';

const NO_EMBEDDINGS: WorkflowEmbedding[] = Object.freeze([]) as unknown as WorkflowEmbedding[];
const NO_FILES: string[] = Object.freeze([]) as unknown as string[];
const PENDING_ID = 'pending:';
const VIDEO_BUCKETS = new Set<BaseModelBucket>(['Wan Video', 'MiniMax H3']);

/** Subscribes to every kind's slice (hooks must not branch) and returns the Image step's api for `kind`. */
export function useKindApi(kind: ModelKind): KindApi {
  const checkpoints = useStore((s) => s.workflow.checkpoints);
  const loras = useStore((s) => s.workflow.loras);
  const embeddings = useStore((s) => s.workflow.embeddings) ?? NO_EMBEDDINGS;
  const controlnets = useControlnets((s) => s.entries);
  const records = usePendingModels((s) => s.records);
  const server = useStore((s) => s.server);
  const { profile } = useModelProfile();
  const cn = useControlnets;
  const pm = usePendingModels;

  const entries = useMemo<ModelEntry[]>(() => {
    const pendingOf = (name: string) => records[pendingKey(kind, name)];
    const withPending = (e: ModelEntry): ModelEntry => {
      const p = pendingOf(e.name);
      return p ? { ...e, pending: p, on: p.userOn } : e;
    };
    switch (kind) {
      case 'checkpoint': {
        const real = checkpoints.map((c, i) => ({ id: c.id, name: c.name, on: true, weight: c.ratio, isBase: i === 0, badge: i === 0 && checkpoints.length > 1 ? 'Base' : undefined }));
        const pending = Object.values(records).filter((r) => r.kind === 'checkpoint' && !r.scope).map((r) => ({ id: PENDING_ID + r.key, name: r.file, on: r.userOn, weight: r.weight, pending: r }));
        return [...real, ...pending];
      }
      case 'lora':
        return loras.map((l) => withPending({ id: l.id, name: l.name, on: l.on, weight: l.strength }));
      case 'embedding':
        return embeddings.map((e) => withPending({ id: e.id, name: e.name, on: e.on, weight: e.strength }));
      case 'controlnet':
        return controlnets.map((c: ControlNetEntry) => withPending({ id: c.id, name: c.name, on: c.on, weight: c.strength }));
      default:
        return [];
    }
  }, [kind, checkpoints, loras, embeddings, controlnets, records]);

  const files = server[KINDS[kind].list] ?? NO_FILES;

  // LoRAs and embeddings that fit the checkpoint's type show first; video models stay out of the checkpoint list.
  const fits = useMemo(() => {
    if (kind === 'checkpoint') return { label: 'images', fits: (b: BaseModelBucket) => !VIDEO_BUCKETS.has(b) };
    if ((kind === 'lora' || kind === 'embedding') && profile) return { label: profile.id, fits: (b: BaseModelBucket) => bucketFits(profile, b) };
    return undefined;
  }, [kind, profile]);

  const add = useCallback((name: string) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': st.addCheckpoint(name); return useStore.getState().workflow.checkpoints.at(-1)?.id;
      case 'lora': st.addLora(name); return useStore.getState().workflow.loras.at(-1)?.id;
      case 'embedding': st.addEmbedding(name); return useStore.getState().workflow.embeddings?.at(-1)?.id;
      case 'controlnet': return cn.getState().add(name);
      default: return undefined;
    }
  }, [kind, cn]);

  const storeSetOn = useCallback((id: string, on: boolean) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return; // a checkpoint is either in the merge or removed
      case 'lora': return st.updateLora(id, { on });
      case 'embedding': return st.updateEmbedding(id, { on });
      case 'controlnet': return cn.getState().update(id, { on });
      default: return;
    }
  }, [kind, cn]);

  const rename = useCallback((id: string, name: string) => {
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.updateCheckpoint(id, { name });
      case 'lora': return st.updateLora(id, { name });
      case 'embedding': return st.updateEmbedding(id, { name });
      case 'controlnet': return cn.getState().update(id, { name });
      default: return;
    }
  }, [kind, cn]);

  const addPending = useCallback((pick: PickLike) => {
    const file = expectedFileName(kind, pick);
    if (!file) return undefined;
    const key = pendingKey(kind, file);
    const existing = pm.getState().records[key];
    if (kind === 'checkpoint') {
      if (!existing) pm.getState().add(recordFromPick(kind, pick, Date.now(), undefined, true, 0.5));
      return PENDING_ID + key;
    }
    const found = entries.find((e) => e.name === file);
    const id = found?.id ?? add(file);
    if (!id) return undefined;
    storeSetOn(id, false);
    if (!existing) pm.getState().add(recordFromPick(kind, pick, Date.now(), id, found?.on ?? true));
    return id;
  }, [kind, entries, add, storeSetOn, pm]);

  const changeToPending = useCallback((id: string, pick: PickLike) => {
    if (kind === 'checkpoint' || id.startsWith(PENDING_ID)) return addPending(pick);
    const file = expectedFileName(kind, pick);
    if (!file) return undefined;
    const was = entries.find((e) => e.id === id);
    if (was?.pending) pm.getState().remove(was.pending.key);
    rename(id, file);
    storeSetOn(id, false);
    pm.getState().add(recordFromPick(kind, pick, Date.now(), id, was?.on ?? true));
    return id;
  }, [kind, entries, addPending, rename, storeSetOn, pm]);

  const remove = useCallback((id: string) => {
    if (id.startsWith(PENDING_ID)) { pm.getState().remove(id.slice(PENDING_ID.length)); return; }
    const was = entries.find((e) => e.id === id);
    if (was?.pending) pm.getState().remove(was.pending.key);
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.removeCheckpoint(id);
      case 'lora': return st.removeLora(id);
      case 'embedding': return st.removeEmbedding(id);
      case 'controlnet': return cn.getState().remove(id);
      default: return;
    }
  }, [kind, cn, pm, entries]);

  const setOn = useCallback((id: string, on: boolean) => {
    const e = entries.find((x) => x.id === id);
    if (e?.pending) { pm.getState().update(e.pending.key, { userOn: on }); return; }
    storeSetOn(id, on);
  }, [entries, storeSetOn, pm]);

  const setWeight = useCallback((id: string, v: number) => {
    if (id.startsWith(PENDING_ID)) { pm.getState().update(id.slice(PENDING_ID.length), { weight: v }); return; }
    const st = useStore.getState();
    switch (kind) {
      case 'checkpoint': return st.updateCheckpoint(id, { ratio: v });
      case 'lora': return st.updateLora(id, { strength: v });
      case 'embedding': return st.updateEmbedding(id, { strength: v });
      case 'controlnet': return cn.getState().update(id, { strength: v });
      default: return;
    }
  }, [kind, cn, pm]);

  return { kind, spec: KINDS[kind], entries, files, add, addPending, changeToPending, remove, rename, setOn, setWeight, fits, pendingScope: IMAGE_SCOPE, card: imageCardParts(kind) };
}

// The Image step's pending scope: how a landed file joins the workflow.
registerPendingScope(IMAGE_SCOPE, {
  has: (r) => {
    const w = useStore.getState().workflow;
    switch (r.kind) {
      case 'checkpoint': return true;
      case 'lora': return w.loras.some((l) => l.id === r.entryId);
      case 'embedding': return (w.embeddings ?? []).some((e) => e.id === r.entryId);
      case 'controlnet': return useControlnets.getState().entries.some((c) => c.id === r.entryId);
      default: return false;
    }
  },
  land: (r, file) => {
    const st = useStore.getState();
    const w = st.workflow;
    switch (r.kind) {
      case 'checkpoint': {
        if (r.scope) return; // another step's slot, not a merge checkpoint
        st.addCheckpoint(file);
        const id = useStore.getState().workflow.checkpoints.at(-1)?.id;
        if (id) st.updateCheckpoint(id, { ratio: r.weight });
        return;
      }
      case 'lora':
        for (const l of w.loras) if (l.id === r.entryId || sameFile(l.name, r.file)) st.updateLora(l.id, { name: file, on: r.userOn });
        return;
      case 'embedding':
        for (const e of w.embeddings ?? []) if (e.id === r.entryId || sameFile(e.name, r.file, 'embedding')) st.updateEmbedding(e.id, { name: file, on: r.userOn });
        return;
      case 'controlnet': {
        const cn = useControlnets.getState();
        for (const c of cn.entries) if (c.id === r.entryId || sameFile(c.name, r.file)) cn.update(c.id, { name: file, on: r.userOn });
        return;
      }
      default: return;
    }
  },
});
