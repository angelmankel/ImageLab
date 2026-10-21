/**
 * The universal model list (rule 4): a kind switch, the row of circles, the selected entry's
 * card, and the picker window. ONE component for every model slot of every step: the Image step
 * shows its four kinds on the main app's workflow (`useKindApi`, the default), the Video step and
 * a Workflow step pass `useApi` — their own `KindApi` (kindApi.ts) on their own stores. A pick that
 * is not downloaded yet becomes a pending entry (dimmed, "not downloaded", editable, a Download
 * button) until its file lands; a named file no server lists shows "not on server".
 *
 * `follow` (fix list item 40, steps after step 1): the "Same models as step 1" switch on top, a
 * link mark on each linked circle, the link strip on the card; changing a linked entry here
 * un-links just that one (the rest keeps following). The live sync itself is the step's own
 * (`workflow/followWorkflow.ts` for a Workflow step).
 */
import { useCallback, useMemo, useState } from 'react';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import type { ResourceKind } from '@/lib/routing';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { useKindApi } from './kinds';
import { IMAGE_KINDS, KINDS, type ModelEntry, type ModelKind } from './kindSpecs';
import { withGenericPending, type KindApi, type PickTarget } from './kindApi';
import { CircleRow } from './CircleRow';
import { EntryCard } from './EntryCard';
import { ModelsModalBridge } from './ModelsModalBridge';
import type { ModelPick } from './pickTypes';
import { usePendingModels } from './pendingModels';
import { isMissing, pendingKey, sameFile } from './pendingLogic';
import { PendingPoller } from './usePendingReconcile';
import { fixedExpect, linkKey, type FollowCaps } from './followLogic';
import { useFollowStore, useStepFollow } from './followStore';
import { useStep1Source } from './step1Source';
import { FollowBar, LinkStrip, type LinkState } from './FollowBar';
import { notifyError, say } from '~/app/notify';

/** A step after step 1 that can follow its models: its id and how its slots behave. */
export interface FollowLink { stepId: string; caps: (kind: ModelKind) => FollowCaps }

type Picker = PickTarget;

/** The main app's availability hook knows these kinds; others get no per-server dimming in the grid. */
const AVAILABILITY_KIND: Partial<Record<ModelKind, ResourceKind>> = { checkpoint: 'checkpoint', lora: 'lora', embedding: 'embedding', vae: 'vae', upscale: 'upscale' };

export function ModelList({ kinds = IMAGE_KINDS, initialKind, useApi = useKindApi, labels, follow }: {
  kinds?: readonly ModelKind[];
  initialKind?: ModelKind;
  /** The step's store behind the list; default = the Image step's workflow. Called once per render, like a hook. */
  useApi?: (kind: ModelKind) => KindApi;
  /** Tab labels a step renames ("Experts" for the Video step's checkpoint kind). */
  labels?: Partial<Record<ModelKind, string>>;
  /** Steps after step 1: "Same models as step 1" (on by default). */
  follow?: FollowLink;
}) {
  const [kindState, setKind] = useState<ModelKind>(initialKind ?? kinds[0]);
  const kind = kinds.includes(kindState) ? kindState : kinds[0];
  const [selectedBy, setSelectedBy] = useState<Partial<Record<ModelKind, string>>>({});
  const [picker, setPicker] = useState<Picker | null>(null);
  const raw = useApi(kind);
  const records = usePendingModels((s) => s.records);
  const anyPending = Object.keys(records).length > 0;
  const availability = useResourceAvailability(AVAILABILITY_KIND[kind] ?? 'checkpoint');

  // Pending (by kind + file name, whichever store) and missing (named, no server lists it) states.
  const entries = useMemo<ModelEntry[]>(() => raw.entries.map((e) => {
    if (e.pending) return e;
    const p = records[pendingKey(kind, e.name)];
    if (p) return { ...e, pending: p, on: p.userOn };
    return isMissing(raw.files, e.name, kind) ? { ...e, missing: true } : e;
  }), [raw.entries, raw.files, records, kind]);
  const generic = useMemo(() => withGenericPending({ ...raw, entries }), [raw, entries]);

  // Follow step 1: which entries are linked, which linked fixed slot cannot take step 1's file.
  const fstate = useStepFollow(follow?.stepId);
  const following = !!follow && !fstate.off;
  const source = useStep1Source(kind);
  const caps = follow?.caps(kind);
  const linkedIds = useMemo(() => {
    if (!following) return new Set<string>();
    const un = new Set(fstate.unlinked ?? []);
    return new Set(entries.filter((e) => !un.has(linkKey(kind, e.id))).map((e) => e.id));
  }, [following, fstate.unlinked, entries, kind]);
  const expect = useMemo(() => (following && caps ? fixedExpect(source, entries.map((e) => ({ ...e, linked: linkedIds.has(e.id) })), caps) : {}), [following, caps, source, entries, linkedIds]);
  const linkState = (e: ModelEntry): LinkState | undefined => {
    if (!following) return undefined;
    if (!linkedIds.has(e.id)) return 'unlinked';
    const want = expect[e.id];
    return want && !sameFile(e.name, want, kind) ? 'blocked' : 'linked';
  };
  // Changing a linked entry here un-links that one first; a new entry is the user's own.
  const api = useMemo<KindApi>(() => {
    if (!following || !follow) return generic;
    const fs = useFollowStore.getState();
    const own = (id: string | undefined) => { if (id) fs.unlink(follow.stepId, linkKey(kind, id)); return id; };
    return {
      ...generic,
      rename: (id, name) => { own(id); generic.rename(id, name); },
      setOn: (id, on) => { own(id); generic.setOn(id, on); },
      setWeight: (id, v) => { own(id); generic.setWeight(id, v); },
      add: generic.add && ((name) => own(generic.add!(name))),
      addPending: generic.addPending && ((p) => own(generic.addPending!(p))),
      changeToPending: generic.changeToPending && ((id, p) => { own(id); return generic.changeToPending!(id, p); }),
      pick: generic.pick && ((t, p) => { if (t.mode === 'change') own(t.id); const r = generic.pick!(t, p); if (t.mode === 'add' && typeof r === 'string') own(r); return r; }),
    };
  }, [generic, following, follow, kind]);

  const selected = entries.find((e) => e.id === selectedBy[kind]) ?? entries[0];
  const select = useCallback((id: string) => setSelectedBy((m) => ({ ...m, [kind]: id })), [kind]);

  const onPick = (pick: ModelPick) => {
    if (!picker) return;
    let id: string | undefined;
    // The step may read the pick itself (a Wan LoRA pair: two files from one version).
    const own = api.pick ? api.pick(picker, pick) : false;
    if (own !== false) {
      id = own;
      if (!id) notifyError('No file to use', undefined, { hint: 'That version has no file.' });
      else if (!pick.installed) say(`${pick.model.name} added: download it from the card`);
    } else if (pick.installed && pick.file) {
      if (picker.mode === 'change') { api.rename(picker.id, pick.file); id = picker.id; }
      else id = entries.find((e) => e.name === pick.file)?.id ?? api.add?.(pick.file);
    } else {
      id = picker.mode === 'change' ? api.changeToPending?.(picker.id, pick) : api.addPending?.(pick);
      if (!id) notifyError('No file to download', undefined, { hint: 'That version has no file.' });
      else say(`${pick.model.name} added: download it from the card`);
    }
    if (id) select(id);
    setPicker(null);
  };

  const { spec } = api;
  const canAdd = !!api.add;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      {anyPending && <PendingPoller />}
      {follow && <FollowBar on={following} setHere={fstate.unlinked?.length ?? 0} onChange={(on) => useFollowStore.getState().setFollow(follow.stepId, on)} />}
      {kinds.length > 1 && <Tabs items={kinds.map((k) => ({ key: k, label: labels?.[k] ?? KINDS[k].label }))} value={kind} onChange={setKind} />}
      <CircleRow entries={entries} selectedId={selected?.id} onSelect={select} onChange={(id) => setPicker({ mode: 'change', id })} onAdd={canAdd ? () => setPicker({ mode: 'add' }) : undefined} onRemove={api.remove} showWeight={!!spec.weight} linked={following ? linkedIds : undefined} kind={kind} />
      {selected ? (
        <EntryCard key={`${kind}:${selected.id}`} entry={selected} api={api} onChange={() => setPicker({ mode: 'change', id: selected.id })}
          link={follow && following ? (
            <LinkStrip state={linkState(selected)!} expected={expect[selected.id]}
              onUnlink={() => useFollowStore.getState().unlink(follow.stepId, linkKey(kind, selected.id))}
              onRelink={() => useFollowStore.getState().relink(follow.stepId, linkKey(kind, selected.id))} />
          ) : undefined} />
      ) : (
        <button type="button" onClick={() => canAdd && setPicker({ mode: 'add' })}
          style={{ border: '1px dashed var(--il-line-strong)', borderRadius: T.radius.xl, background: 'transparent', color: 'var(--il-muted)', padding: '22px 12px', fontSize: 12, fontWeight: 700, cursor: canAdd ? 'pointer' : 'default', textAlign: 'center' }}>
          {canAdd ? `No ${spec.one} yet · tap + Add` : `No ${spec.one} slot`}
        </button>
      )}
      <ModelsModalBridge
        opened={!!picker}
        onClose={() => setPicker(null)}
        kind={spec.pick}
        baseModels={spec.baseModels}
        title={picker?.mode === 'change' ? `Change the ${spec.one}` : `Add a ${spec.one}`}
        onPick={onPick}
        fallback={{ files: api.files, selected: entries.map((e) => e.name), fits: api.fits, availability: AVAILABILITY_KIND[kind] ? availability : undefined }}
      />
    </div>
  );
}
