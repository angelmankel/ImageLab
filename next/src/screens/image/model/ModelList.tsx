/**
 * The universal model list (rule 4): a kind switch, the row of circles, the selected entry's
 * card, and the picker window. One component for every kind; the Image step shows all four, the
 * Upscale / Video steps can pass a smaller `kinds`. State is the main app's workflow through
 * `useKindApi`; which circle is selected is local. A pick that is not downloaded yet becomes a
 * pending entry (dimmed, "not downloaded", editable, a Download button) until its file lands.
 */
import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { bucketFits } from '@/lib/modelProfiles';
import type { BaseModelBucket } from '@/lib/modelHash';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { ALL_KINDS, KINDS, useKindApi, type ModelKind } from './kinds';
import { CircleRow } from './CircleRow';
import { EntryCard } from './EntryCard';
import { ModelsModalBridge } from './ModelsModalBridge';
import type { ModelPick } from './pickTypes';
import { usePendingModels } from './pendingModels';
import { PendingPoller, usePendingReconcile } from './usePendingReconcile';

type Picker = { mode: 'add' } | { mode: 'change'; id: string };

const VIDEO_BUCKETS = new Set<BaseModelBucket>(['Wan Video', 'MiniMax H3']);

export function ModelList({ kinds = ALL_KINDS, initialKind }: { kinds?: readonly ModelKind[]; initialKind?: ModelKind }) {
  const [kind, setKind] = useState<ModelKind>(initialKind ?? kinds[0]);
  const [selectedBy, setSelectedBy] = useState<Partial<Record<ModelKind, string>>>({});
  const [picker, setPicker] = useState<Picker | null>(null);
  const api = useKindApi(kind);
  const { profile } = useModelProfile();
  const availability = useResourceAvailability(kind === 'controlnet' ? 'checkpoint' : kind);
  const anyPending = usePendingModels((s) => Object.keys(s.records).length > 0);
  usePendingReconcile();

  const selected = api.entries.find((e) => e.id === selectedBy[kind]) ?? api.entries[0];
  const select = useCallback((id: string) => setSelectedBy((m) => ({ ...m, [kind]: id })), [kind]);

  // LoRAs and embeddings that fit the checkpoint's type show first; video models stay out of the checkpoint list.
  const fits = useMemo(() => {
    if (kind === 'checkpoint') return { label: 'images', fits: (b: BaseModelBucket) => !VIDEO_BUCKETS.has(b) };
    if ((kind === 'lora' || kind === 'embedding') && profile) return { label: profile.id, fits: (b: BaseModelBucket) => bucketFits(profile, b) };
    return undefined;
  }, [kind, profile]);

  const onPick = (pick: ModelPick) => {
    if (!picker) return;
    let id: string | undefined;
    if (pick.installed && pick.file) {
      if (picker.mode === 'change') { api.rename(picker.id, pick.file); id = picker.id; }
      else id = api.entries.find((e) => e.name === pick.file)?.id ?? api.add(pick.file);
    } else {
      id = picker.mode === 'change' ? api.changeToPending(picker.id, pick) : api.addPending(pick);
      if (!id) notifications.show({ color: 'yellow', message: 'That version has no file to download' });
      else notifications.show({ color: 'ember', message: `${pick.model.name} added · download it from the card` });
    }
    if (id) select(id);
    setPicker(null);
  };

  const spec = KINDS[kind];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.md }}>
      {anyPending && <PendingPoller />}
      <Tabs items={kinds.map((k) => ({ key: k, label: KINDS[k].label }))} value={kind} onChange={setKind} />
      <CircleRow entries={api.entries} selectedId={selected?.id} onSelect={select} onAdd={() => setPicker({ mode: 'add' })} />
      {selected ? (
        <EntryCard key={`${kind}:${selected.id}`} entry={selected} api={api} onChange={() => setPicker({ mode: 'change', id: selected.id })} />
      ) : (
        <button type="button" onClick={() => setPicker({ mode: 'add' })}
          style={{ border: '1px dashed var(--il-line-strong)', borderRadius: T.radius.xl, background: 'transparent', color: 'var(--il-muted)', padding: '22px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
          No {spec.one} yet · tap + Add
        </button>
      )}
      <ModelsModalBridge
        opened={!!picker}
        onClose={() => setPicker(null)}
        kind={kind}
        title={picker?.mode === 'change' ? `Change the ${spec.one}` : `Add a ${spec.one}`}
        onPick={onPick}
        fallback={{ files: api.files, selected: api.entries.map((e) => e.name), fits, availability: kind === 'controlnet' ? undefined : availability }}
      />
    </div>
  );
}
