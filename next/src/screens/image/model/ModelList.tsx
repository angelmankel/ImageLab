/**
 * The universal model list (rule 4): a kind switch, the row of circles, the selected entry's
 * card, and the picker window. ONE component for every model slot of every step: the Image step
 * shows its four kinds on the main app's workflow (`useKindApi`, the default), the Video step and
 * a Workflow step pass `useApi` — their own `KindApi` (kindApi.ts) on their own stores. A pick that
 * is not downloaded yet becomes a pending entry (dimmed, "not downloaded", editable, a Download
 * button) until its file lands; a named file no server lists shows "not on server".
 */
import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import type { ResourceKind } from '@/lib/routing';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { useKindApi } from './kinds';
import { IMAGE_KINDS, KINDS, type ModelEntry, type ModelKind } from './kindSpecs';
import { withGenericPending, type KindApi } from './kindApi';
import { CircleRow } from './CircleRow';
import { EntryCard } from './EntryCard';
import { ModelsModalBridge } from './ModelsModalBridge';
import type { ModelPick } from './pickTypes';
import { usePendingModels } from './pendingModels';
import { isMissing, pendingKey } from './pendingLogic';
import { PendingPoller } from './usePendingReconcile';

type Picker = { mode: 'add' } | { mode: 'change'; id: string };

/** The main app's availability hook knows these kinds; others get no per-server dimming in the grid. */
const AVAILABILITY_KIND: Partial<Record<ModelKind, ResourceKind>> = { checkpoint: 'checkpoint', lora: 'lora', embedding: 'embedding', vae: 'vae', upscale: 'upscale' };

export function ModelList({ kinds = IMAGE_KINDS, initialKind, useApi = useKindApi, labels }: {
  kinds?: readonly ModelKind[];
  initialKind?: ModelKind;
  /** The step's store behind the list; default = the Image step's workflow. Called once per render, like a hook. */
  useApi?: (kind: ModelKind) => KindApi;
  /** Tab labels a step renames ("Experts" for the Video step's checkpoint kind). */
  labels?: Partial<Record<ModelKind, string>>;
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
  const api = useMemo(() => withGenericPending({ ...raw, entries }), [raw, entries]);

  const selected = entries.find((e) => e.id === selectedBy[kind]) ?? entries[0];
  const select = useCallback((id: string) => setSelectedBy((m) => ({ ...m, [kind]: id })), [kind]);

  const onPick = (pick: ModelPick) => {
    if (!picker) return;
    let id: string | undefined;
    if (pick.installed && pick.file) {
      if (picker.mode === 'change') { api.rename(picker.id, pick.file); id = picker.id; }
      else id = entries.find((e) => e.name === pick.file)?.id ?? api.add?.(pick.file);
    } else {
      id = picker.mode === 'change' ? api.changeToPending?.(picker.id, pick) : api.addPending?.(pick);
      if (!id) notifications.show({ color: 'yellow', message: 'That version has no file to download' });
      else notifications.show({ color: 'ember', message: `${pick.model.name} added · download it from the card` });
    }
    if (id) select(id);
    setPicker(null);
  };

  const { spec } = api;
  const canAdd = !!api.add;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      {anyPending && <PendingPoller />}
      {kinds.length > 1 && <Tabs items={kinds.map((k) => ({ key: k, label: labels?.[k] ?? KINDS[k].label }))} value={kind} onChange={setKind} />}
      <CircleRow entries={entries} selectedId={selected?.id} onSelect={select} onAdd={canAdd ? () => setPicker({ mode: 'add' }) : undefined} showWeight={!!spec.weight} />
      {selected ? (
        <EntryCard key={`${kind}:${selected.id}`} entry={selected} api={api} onChange={() => setPicker({ mode: 'change', id: selected.id })} />
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
