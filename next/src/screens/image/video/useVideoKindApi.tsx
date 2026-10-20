/**
 * The Video step's `KindApi` for the universal model list (rule 4): the engine's experts /
 * checkpoint, LoRAs, text encoder and VAEs as list entries on the main app's `videoStore`
 * (`@/features/video/videoStore`), every edit through `videoKinds.ts`'s pure patches.
 *
 * A Wan LoRA entry is a PAIR (Donny, 10-20): its card holds the high-noise file (the head) and
 * the low-noise file (`WanLowSlot`, under the strength), one circle in the row ("H+L"). One pick
 * of a CivitAI version that ships both files fills both and starts both downloads
 * (`wanLoraPair.ts`); each half is its own pending record (`kind:file`), the low one keyed to
 * the entry as `<id>:low` so a landed download lands on `nameLow`. Trigger words tap into the
 * motion prompt. Registers the 'video' pending scope.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useVideo, type VideoState } from '@/features/video/videoStore';
import type { VideoLora } from '@/lib/wanGraph';
import { SliderRow, Switch, Tabs } from '~/ui';
import {
  TriggerWords, registerPendingScope, fmtWeight, usePendingModels, pendingKey, metaWithPending, useModelMeta,
  type KindApi, type ModelKind, type CardParts, type ModelMeta, type PendingRecord,
} from '~/screens/image/model';
import { pairOtherHalf, videoEntries, videoHasFile, videoLandPatch, videoRemovePatch, videoSetOnPatch, videoSetWeightPatch, videoSlotPatch, videoSpec, type VideoPatch } from './videoKinds';
import { highSlotLabel } from './wanLoraPair';
import { VIDEO_SCOPE, pickWanLora } from './wanLoraPick';
import { WanLowSlot } from './WanLoraPairCard';

export { VIDEO_SCOPE } from './wanLoraPick';
const NO_FILES: string[] = Object.freeze([]) as unknown as string[];
const PRESETS = [0.5, 0.8, 1, 1.2];

// A patch is built by spreading the real state (videoKinds.ts), so the structural subset carries every H3 field.
const apply = (patch: VideoPatch | null) => { if (patch) useVideo.getState().set(patch as Partial<VideoState>); };

const loraOf = (id: string): VideoLora | undefined => useVideo.getState().loras.find((l) => l.id === id);
/** The pending record of a pair's low file while its high file is not pending itself. */
function lowOnlyRecord(loras: readonly VideoLora[], id: string, records: Record<string, PendingRecord>): PendingRecord | undefined {
  const l = loras.find((x) => x.id === id);
  if (!l?.nameLow || records[pendingKey('lora', l.name)]) return undefined;
  return records[pendingKey('lora', l.nameLow)];
}
/** A user's own Wan LoRA (not a fixed slot, not H3). */
const wanUser = (e: { id: string; fixed?: boolean }) => !e.fixed && useVideo.getState().engine === 'wan' && !!loraOf(e.id);

export function useVideoKindApi(kind: ModelKind): KindApi {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const records = usePendingModels((s) => s.records);
  const spec = useMemo(() => videoSpec(v.engine, kind), [v.engine, kind]);
  const h3 = v.engine === 'h3';
  // A pair whose low file alone still downloads: the switch shows (and edits) that record's choice,
  // the way the list does for an entry whose main file waits (the store entry stays Off meanwhile).
  const entries = useMemo(() => {
    const base = videoEntries(v, kind);
    if (kind !== 'lora' || h3) return base;
    return base.map((e) => { const r = lowOnlyRecord(v.loras, e.id, records); return r ? { ...e, on: r.userOn } : e; });
  }, [v, kind, h3, records]);
  const files = server[spec.list] ?? NO_FILES;

  return useMemo<KindApi>(() => ({
    kind, spec, entries, files,
    pendingScope: VIDEO_SCOPE,
    add: kind === 'lora' ? (name) => {
      const st = useVideo.getState();
      if (h3) { st.addH3Lora(name); return useVideo.getState().h3.loras.at(-1)?.id; }
      st.addLora(name);
      return useVideo.getState().loras.at(-1)?.id;
    } : undefined,
    // Wan LoRAs read the whole pick: a version's high + low files land in one entry.
    pick: kind === 'lora' && !h3 ? (target, pick) => pickWanLora(target, pick) : undefined,
    remove: kind === 'lora' ? (id) => apply(videoRemovePatch(useVideo.getState(), id)) : undefined,
    rename: (id, name) => apply(videoSlotPatch(useVideo.getState(), id, name)),
    setOn: (id, on) => {
      const r = lowOnlyRecord(useVideo.getState().loras, id, usePendingModels.getState().records);
      if (r) { usePendingModels.getState().update(r.key, { userOn: on }); return; }
      apply(videoSetOnPatch(useVideo.getState(), id, on));
    },
    setWeight: (id, w) => apply(videoSetWeightPatch(useVideo.getState(), id, w)),
    card: kind === 'lora' ? LORA_CARD : undefined,
  }), [kind, spec, entries, files, h3]);
}

const LORA_CARD: CardParts = {
  headLabel: (e) => { const l = wanUser(e) ? loraOf(e.id) : undefined; return l ? highSlotLabel(l) : undefined; },
  words: (e, meta) => (e.fixed ? null : <VideoWords id={e.id} meta={meta} />),
  weightLabel: (e) => (wanUser(e) && loraOf(e.id)?.nameLow ? 'Strength · high' : undefined),
  after: (e) => (wanUser(e) ? <WanLowSlot id={e.id} /> : null),
  // A pair is always both experts: nothing to fold away.
  more: (e) => (e.fixed || (wanUser(e) && loraOf(e.id)?.nameLow) ? null : <LoraMore id={e.id} />),
  moreHint: (e) => (e.fixed || useVideo.getState().engine === 'h3' ? undefined : 'expert, low strength'),
};

/** Trigger words that go into the motion prompt: the high file's, else the low file's. */
function VideoWords({ id, meta }: { id: string; meta: ModelMeta }) {
  const positive = useVideo((s) => s.positive);
  const nameLow = useVideo((s) => s.loras.find((l) => l.id === id)?.nameLow) ?? '';
  const record = usePendingModels((s) => (nameLow ? s.records[pendingKey('lora', nameLow)] : undefined));
  const low = metaWithPending(useModelMeta(nameLow), record);
  const words = meta.trainedWords.length ? meta.trainedWords : low.trainedWords;
  if (!words.length) return null;
  return <TriggerWords words={words} text={positive} onText={(positive) => useVideo.getState().set({ positive })} title="Trigger words · tap to add to the motion prompt" />;
}

/** A single-file Wan LoRA: which expert it patches and an own strength on the low-noise one; H3: a note. */
function LoraMore({ id }: { id: string }) {
  const engine = useVideo((s) => s.engine);
  const wan = useVideo((s) => s.loras.find((l) => l.id === id));
  if (engine === 'h3' || !wan) return <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>MiniMax H3 LoRAs go on the one model.</span>;
  const update = (p: Partial<typeof wan>) => useVideo.getState().updateLora(id, p);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>This one file patches</span>
        <Tabs<'both' | 'high' | 'low'> compact items={[{ key: 'both', label: 'Both' }, { key: 'high', label: 'High only' }, { key: 'low', label: 'Low only' }]} value={wan.expert} onChange={(expert) => update({ expert })} />
        <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>Wan 2.2 LoRAs usually come as a high-noise and a low-noise file: pick the low one above and the pair patches both experts, each with its own file.</span>
      </div>
      {wan.expert === 'both' && (
        <>
          <Switch label="Own strength on the low-noise expert" checked={wan.strengthLow != null} onChange={(on) => update({ strengthLow: on ? wan.strength : null })} />
          {wan.strengthLow != null && <SliderRow label="Strength · low" value={wan.strengthLow} min={0} max={2} step={0.05} presets={PRESETS} format={fmtWeight} onChange={(strengthLow) => update({ strengthLow })} />}
        </>
      )}
    </>
  );
}

registerPendingScope(VIDEO_SCOPE, {
  has: (r) => videoHasFile(useVideo.getState(), r.kind, r.file),
  land: (r, file) => {
    const st = useVideo.getState();
    const pm = usePendingModels.getState();
    // A pair comes back On only once both halves are here: the half that lands first hands the
    // user's choice to the other half's record, which restores it when it lands.
    const other = r.kind === 'lora' ? pairOtherHalf(st, r.file) : null;
    const otherKey = other ? pendingKey('lora', other) : null;
    const waiting = !!otherKey && !!pm.records[otherKey];
    if (waiting) pm.update(otherKey!, { userOn: r.userOn });
    apply(videoLandPatch(st, r.kind, r.file, file, waiting ? false : r.userOn));
  },
});
