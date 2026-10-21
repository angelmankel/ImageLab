/**
 * The contract between the universal list (`ModelList`) and whichever store a step keeps its
 * models in (rule 4: ONE component for every model slot of every step). A step hands the list a
 * `useApi(kind)` hook that returns a `KindApi`; the Image step's is `useKindApi` (kinds.ts), the
 * Video step's `useVideoKindApi`, a Workflow step's `useWorkflowKindApi`.
 *
 * Pending (picked before the download finished) is generic: an api that does not implement
 * `addPending` / `changeToPending` gets `withGenericPending` — the slot is renamed to the file the
 * server will list, a record keyed by kind + file is kept in `pendingModels`, the entry shows
 * dimmed with the strip until `usePendingReconcile` sees the file on a server list.
 */
import type { ReactNode } from 'react';
import type { KindSpec, ModelEntry, ModelKind } from './kindSpecs';
import type { ModelMeta } from './useModelMeta';
import { expectedFileName, pendingKey, recordFromPick, type PendingRecord, type PickLike } from './pendingLogic';
import { usePendingModels } from './pendingModels';

/** The per-kind pieces of the entry card a step may add (all optional). */
export interface CardParts {
  /** An eyebrow above the head ("High noise" on a Wan LoRA whose card holds two files). */
  headLabel?: (entry: ModelEntry) => string | undefined;
  /** Under the head: trigger words etc. */
  words?: (entry: ModelEntry, meta: ModelMeta) => ReactNode;
  /** Between the words and the weight: a kind's own input (ControlNet's guide image). */
  body?: (entry: ModelEntry) => ReactNode;
  /** The "More ▾" fold; absent = no More button. */
  more?: (entry: ModelEntry, meta?: ModelMeta) => ReactNode;
  /** "More · CLIP strength, defaults" */
  moreHint?: (entry: ModelEntry) => string | undefined;
  /** The weight slider's label when the kind's is not right ("Strength · high"). */
  weightLabel?: (entry: ModelEntry) => string | undefined;
  /** A hint under the weight slider. */
  weightHint?: (entry: ModelEntry) => string | undefined;
  /** Under the weight slider, before More: a second file slot (a Wan LoRA's low-noise file). */
  after?: (entry: ModelEntry) => ReactNode;
}

/** What the list's picker was opened for. */
export type PickTarget = { mode: 'add' } | { mode: 'change'; id: string };

export interface KindApi {
  kind: ModelKind;
  spec: KindSpec;
  entries: ModelEntry[];
  /** Every file of this kind the servers offer. */
  files: string[];
  /** Adds an installed file and returns the entry id. Absent: fixed slots, no "+ Add". */
  add?: (name: string) => string | undefined;
  /** Absent: entries cannot be removed. */
  remove?: (id: string) => void;
  rename: (id: string, name: string) => void;
  setOn: (id: string, on: boolean) => void;
  setWeight: (id: string, v: number) => void;
  /** Adds a model that is not downloaded yet; undefined when the pick names no file. Absent: generic. */
  addPending?: (pick: PickLike) => string | undefined;
  /** Points an entry at a not-yet-downloaded model. Absent: generic. */
  changeToPending?: (id: string, pick: PickLike) => string | undefined;
  /**
   * Takes the whole pick itself, installed or not — a step whose entry can hold more than one
   * file of a version (a Wan LoRA's high + low). Returns the entry id, undefined when the pick
   * names no file, or false when the target is not its business (a fixed slot): then, as when
   * absent, the list adds / renames installed files and routes the rest through `addPending` /
   * `changeToPending`.
   */
  pick?: (target: PickTarget, pick: PickLike) => string | undefined | false;
  /** The pending-record scope this store registered with `registerPendingScope`. */
  pendingScope?: string;
  /** Only files whose base-model bucket fits show in the server-file grid, until "Show all". */
  fits?: { label: string; fits: (bucket: import('@/lib/modelHash').BaseModelBucket) => boolean };
  card?: CardParts;
}

/** The record a generic api keeps for a pick: where it lands and which list it shows up in. */
function recordFor(api: KindApi, pick: PickLike, entryId: string, userOn: boolean): PendingRecord {
  return recordFromPick(api.kind, pick, Date.now(), entryId, userOn, 1, { scope: api.pendingScope, folder: api.spec.folder, list: api.spec.list });
}

/**
 * Pending on top of an api's primitives: `addPending` adds (or finds) the entry under the expected
 * file name and switches it off while it waits; `changeToPending` renames a slot; `setOn` on a
 * waiting entry edits the record's choice; `remove` drops the record with the entry.
 */
export function withGenericPending(api: KindApi): KindApi {
  if (api.addPending && api.changeToPending) return api;
  const pm = usePendingModels;
  const find = (id: string) => api.entries.find((e) => e.id === id);

  const addPending = (pick: PickLike) => {
    if (!api.add) return undefined;
    const file = expectedFileName(api.kind, pick);
    if (!file) return undefined;
    const found = api.entries.find((e) => e.name === file);
    const id = found?.id ?? api.add(file);
    if (!id) return undefined;
    if (api.spec.hasSwitch) api.setOn(id, false);
    if (!pm.getState().records[pendingKey(api.kind, file)]) pm.getState().add(recordFor(api, pick, id, found?.on ?? true));
    return id;
  };

  const changeToPending = (id: string, pick: PickLike) => {
    const file = expectedFileName(api.kind, pick);
    if (!file) return undefined;
    const was = find(id);
    if (!was) return addPending(pick);
    if (was.pending) pm.getState().remove(was.pending.key);
    api.rename(id, file);
    if (api.spec.hasSwitch) api.setOn(id, false);
    if (!pm.getState().records[pendingKey(api.kind, file)]) pm.getState().add(recordFor(api, pick, id, was.on));
    return id;
  };

  const setOn = (id: string, on: boolean) => {
    const e = find(id);
    if (e?.pending) { pm.getState().update(e.pending.key, { userOn: on }); return; }
    api.setOn(id, on);
  };

  const remove = api.remove ? (id: string) => {
    const e = find(id);
    if (e?.pending) pm.getState().remove(e.pending.key);
    api.remove!(id);
  } : undefined;

  return { ...api, addPending, changeToPending, setOn, remove };
}
