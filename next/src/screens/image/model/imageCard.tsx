/**
 * The Image step's per-kind card pieces (rule 4): checkpoint / LoRA trigger words with the main
 * app's Auto switch, the embedding's words and prompt side, the LoRA's CLIP strength, the base
 * checkpoint's VAE + model type, the ControlNet guide image + preprocessor. Handed to the universal
 * card through `KindApi.card`; every piece reads and writes the main app's workflow.
 */
import { useStore } from '@/lib/store';
import { embeddingExtraWords } from '@/lib/embeddings';
import { modelKeywordState } from '@/lib/modelKeywords';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { modelLabel } from '@/components/models/modelInfo';
import { blobToImageState } from '@/features/inputImage/imageOps';
import { ImageDropZone } from '~/compose/ImageDropZone';
import { Chip, SearchSelect, SliderRow, Switch, Tabs } from '~/ui';
import { TriggerWords, type AutoWords } from './TriggerWords';
import { fmtWeight, type ModelKind } from './kindSpecs';
import type { CardParts } from './kindApi';
import { PREPROCESSORS, useControlnets, type ControlNetImage, type Preprocessor } from './controlnetStore';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';

export const SELECT_STYLES = {
  input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 700, fontSize: 12, height: 32, minHeight: 32 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

const MORE_HINT: Partial<Record<ModelKind, string>> = {
  checkpoint: 'VAE, model type',
  lora: 'CLIP strength, defaults',
  embedding: 'prompt side',
  controlnet: 'notes',
};

const NOTE = { fontSize: 11, color: 'var(--il-muted)' } as const;

const PARTS: Partial<Record<ModelKind, CardParts>> = {
  checkpoint: {
    words: (e, meta) => <ModelWords file={e.name} words={meta.trainedWords} />,
    more: (e) => (e.isBase ? <BaseCheckpointMore /> : <span style={NOTE}>Merged into the base with ModelMergeSimple at the ratio above.</span>),
    moreHint: () => MORE_HINT.checkpoint,
    weightHint: () => 'How much of this model blends into the base',
  },
  lora: {
    words: (e, meta) => <ModelWords file={e.name} words={meta.trainedWords} />,
    more: (e) => <LoraMore id={e.id} />,
    moreHint: () => MORE_HINT.lora,
  },
  embedding: {
    more: (e, meta) => <EmbeddingMore id={e.id} words={meta ? embeddingExtraWords(e.name, meta.trainedWords) : []} />,
    moreHint: () => MORE_HINT.embedding,
  },
  controlnet: {
    body: (e) => <ControlNetInput id={e.id} />,
    more: () => <span style={NOTE}>ControlNet runs when the graph builder takes these entries; until then they are saved with the step.</span>,
    moreHint: () => MORE_HINT.controlnet,
  },
};

export const imageCardParts = (kind: ModelKind): CardParts | undefined => PARTS[kind];

// ── per-kind parts ────────────────────────────────────────────────────────

/** Checkpoint / LoRA trigger words, with the main app's per-model Auto switch. */
function ModelWords({ file, words }: { file: string; words: string[] }) {
  const saved = useStore((s) => s.workflow.modelKeywords?.[file]);
  const state = modelKeywordState({ modelKeywords: saved ? { [file]: saved } : undefined }, file);
  const auto: AutoWords = {
    on: state.on,
    set: (on) => {
      const st = useStore.getState();
      st.setWorkflow({ modelKeywords: { ...(st.workflow.modelKeywords ?? {}), [file]: { ...modelKeywordState(st.workflow, file), on } } });
    },
  };
  if (!words.length) return null;
  return <TriggerWords words={words} auto={auto} />;
}

function LoraMore({ id }: { id: string }) {
  const lora = useStore((s) => s.workflow.loras.find((l) => l.id === id));
  const updateLora = useStore((s) => s.updateLora);
  if (!lora) return null;
  return (
    <>
      <SliderRow label="CLIP strength" value={lora.clipStrength} min={0} max={2} step={0.05} presets={[0.5, 0.8, 1, 1.2]} format={fmtWeight}
        onChange={(clipStrength) => updateLora(id, { clipStrength })} hint="How much the LoRA changes the way the words read" />
      <div style={{ display: 'flex', gap: 6 }}>
        <Chip small onClick={() => updateLora(id, { strength: 1, clipStrength: 1 })} title="Reset strengths">Defaults</Chip>
        <Chip small onClick={() => updateLora(id, { clipStrength: lora.strength })} title="Match CLIP strength">CLIP = strength</Chip>
      </div>
    </>
  );
}

const BUILT_IN_VAE = '__builtin__';

function BaseCheckpointMore() {
  const vae = useStore((s) => s.workflow.vae);
  const vaes = useStore((s) => s.server.vaes);
  const setWorkflow = useUndoableSetWorkflow();
  const { profile, detected } = useModelProfile();
  const options = [{ value: BUILT_IN_VAE, label: "Checkpoint's built-in VAE" }, ...[...new Set([...(vae ? [vae] : []), ...vaes])].map((v) => ({ value: v, label: modelLabel(v) }))];
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>VAE</span>
        <SearchSelect options={options} value={vae || BUILT_IN_VAE} onChange={(v) => setWorkflow({ vae: !v || v === BUILT_IN_VAE ? '' : v })} label="VAE" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--il-fg2)' }}>Model type</span>
        <span style={{ fontWeight: 800 }}>{profile?.id ?? (detected === undefined ? 'Looking up…' : 'Unknown')}</span>
      </div>
    </>
  );
}

/**
 * An embedding's fold (item 32): which prompt it joins, and — only when CivitAI lists trigger words
 * other than the embedding's own name — "Also add trigger words" (off by default; they join at the
 * embedding's one strength). No second weight.
 */
function EmbeddingMore({ id, words }: { id: string; words: string[] }) {
  const entry = useStore((s) => s.workflow.embeddings?.find((e) => e.id === id));
  const updateEmbedding = useStore((s) => s.updateEmbedding);
  if (!entry) return null;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Joins which prompt</span>
        <Tabs compact items={[{ key: 'positive', label: 'Positive' }, { key: 'negative', label: 'Negative' }]} value={entry.target} onChange={(target) => updateEmbedding(id, { target })} />
      </div>
      {words.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Switch label="Also add trigger words" checked={!!entry.addWords} onChange={(addWords) => updateEmbedding(id, { addWords })} />
          <span style={{ ...NOTE, wordBreak: 'break-word', opacity: entry.addWords ? 1 : 0.6 }}>{words.join(', ')}</span>
        </div>
      )}
    </>
  );
}

/** ControlNet: the guide image (the shared drop zone: drop · Upload · Library · Paste) and the preprocessor. */
function ControlNetInput({ id }: { id: string }) {
  const entry = useControlnets((s) => s.entries.find((e) => e.id === id));
  const update = useControlnets((s) => s.update);
  if (!entry) return null;
  const img = entry.image;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Guide image</span>
      <ImageDropZone url={img?.dataUrl ?? null} name={img?.name} dims={img ? { width: img.width, height: img.height } : null} small emptyTitle="Add a guide image"
        onBlob={async ({ blob, name }) => { const st = await blobToImageState(blob, name); update(id, { image: { dataUrl: st.dataUrl, name: st.name, width: st.width, height: st.height } satisfies ControlNetImage }); }}
        onClear={() => update(id, { image: null })} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Preprocessor</span>
      <SearchSelect options={PREPROCESSORS.map((p) => ({ value: p, label: p === 'none' ? 'None (image as is)' : p }))} value={entry.preprocessor}
        onChange={(v) => update(id, { preprocessor: v as Preprocessor })} searchable={false} label="Preprocessor" />
    </div>
  );
}
