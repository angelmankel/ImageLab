/**
 * The Video step's `KindApi` for the universal model list (rule 4): the engine's experts /
 * checkpoint, LoRAs, text encoder and VAEs as list entries on the main app's `videoStore`
 * (`@/features/video/videoStore`), every edit through `videoKinds.ts`'s pure patches. The LoRA
 * card gets the Wan expert pick (High · Low · Both + own low strength) under More and trigger
 * words that tap into the motion prompt. Registers the 'video' pending scope: a download that
 * lands renames the waiting slot to the name the server lists.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useVideo, type VideoState } from '@/features/video/videoStore';
import { SliderRow, Switch, Tabs } from '~/ui';
import { TriggerWords, registerPendingScope, fmtWeight, type KindApi, type ModelKind, type CardParts } from '~/screens/image/model';
import { videoEntries, videoHasFile, videoLandPatch, videoRemovePatch, videoSetOnPatch, videoSetWeightPatch, videoSlotPatch, videoSpec, type VideoPatch } from './videoKinds';

export const VIDEO_SCOPE = 'video';
const NO_FILES: string[] = Object.freeze([]) as unknown as string[];
const PRESETS = [0.5, 0.8, 1, 1.2];

// A patch is built by spreading the real state (videoKinds.ts), so the structural subset carries every H3 field.
const apply = (patch: VideoPatch | null) => { if (patch) useVideo.getState().set(patch as Partial<VideoState>); };

export function useVideoKindApi(kind: ModelKind): KindApi {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const spec = useMemo(() => videoSpec(v.engine, kind), [v.engine, kind]);
  const entries = useMemo(() => videoEntries(v, kind), [v, kind]);
  const files = server[spec.list] ?? NO_FILES;
  const h3 = v.engine === 'h3';

  return useMemo<KindApi>(() => ({
    kind, spec, entries, files,
    pendingScope: VIDEO_SCOPE,
    add: kind === 'lora' ? (name) => {
      const st = useVideo.getState();
      if (h3) { st.addH3Lora(name); return useVideo.getState().h3.loras.at(-1)?.id; }
      st.addLora(name);
      return useVideo.getState().loras.at(-1)?.id;
    } : undefined,
    remove: kind === 'lora' ? (id) => apply(videoRemovePatch(useVideo.getState(), id)) : undefined,
    rename: (id, name) => apply(videoSlotPatch(useVideo.getState(), id, name)),
    setOn: (id, on) => apply(videoSetOnPatch(useVideo.getState(), id, on)),
    setWeight: (id, w) => apply(videoSetWeightPatch(useVideo.getState(), id, w)),
    card: kind === 'lora' ? LORA_CARD : undefined,
  }), [kind, spec, entries, files, h3]);
}

const LORA_CARD: CardParts = {
  words: (e, meta) => (e.fixed ? null : <VideoWords words={meta.trainedWords} />),
  more: (e) => (e.id.startsWith('wan:') || e.id.startsWith('h3:') ? null : <LoraMore id={e.id} />),
  moreHint: (e) => (e.fixed ? undefined : useVideo.getState().engine === 'h3' ? undefined : 'expert, low strength'),
};

/** Trigger words that go into the motion prompt. */
function VideoWords({ words }: { words: string[] }) {
  const positive = useVideo((s) => s.positive);
  if (!words.length) return null;
  return <TriggerWords words={words} text={positive} onText={(positive) => useVideo.getState().set({ positive })} title="Trigger words · tap to add to the motion prompt" />;
}

/** Wan: which expert the LoRA patches and an own strength on the low-noise one; H3: a note. */
function LoraMore({ id }: { id: string }) {
  const engine = useVideo((s) => s.engine);
  const wan = useVideo((s) => s.loras.find((l) => l.id === id));
  if (engine === 'h3' || !wan) return <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>MiniMax H3 LoRAs go on the one model.</span>;
  const update = (p: Partial<typeof wan>) => useVideo.getState().updateLora(id, p);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Patches which expert</span>
        <Tabs<'high' | 'low' | 'both'> compact items={[{ key: 'high', label: 'High noise' }, { key: 'low', label: 'Low noise' }, { key: 'both', label: 'Both' }]} value={wan.expert} onChange={(expert) => update({ expert })} />
        <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>Wan 2.2 LoRAs come as a high-noise and a low-noise file; a name that says which starts on that expert.</span>
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
  land: (r, file) => apply(videoLandPatch(useVideo.getState(), r.kind, r.file, file, r.userOn)),
});
