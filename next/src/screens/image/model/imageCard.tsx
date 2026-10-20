/**
 * The Image step's per-kind card pieces (rule 4): checkpoint / LoRA trigger words with the main
 * app's Auto switch, the embedding's words and prompt side, the LoRA's CLIP strength, the base
 * checkpoint's VAE + model type, the ControlNet guide image + preprocessor. Handed to the universal
 * card through `KindApi.card`; every piece reads and writes the main app's workflow.
 */
import { useRef } from 'react';
import { IconPhotoPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { embeddingWords } from '@/lib/embeddings';
import { modelKeywordState } from '@/lib/modelKeywords';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { modelLabel } from '@/components/models/modelInfo';
import { Chip, SearchSelect, SliderRow, Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { TriggerWords, type AutoWords } from './TriggerWords';
import { fmtWeight, type ModelKind } from './kindSpecs';
import type { CardParts } from './kindApi';
import { PREPROCESSORS, useControlnets, type ControlNetImage, type Preprocessor } from './controlnetStore';

export const SELECT_STYLES = {
  input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 700, fontSize: 12, height: 32, minHeight: 32 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

const MORE_HINT: Partial<Record<ModelKind, string>> = {
  checkpoint: 'VAE, model type',
  lora: 'CLIP strength, defaults',
  embedding: 'prompt side, trigger words',
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
    words: (e, meta) => <EmbeddingWords id={e.id} words={embeddingWords(meta.trainedWords)} />,
    more: (e) => <EmbeddingMore id={e.id} />,
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

/** An embedding's own trigger words; its Auto is the entry's `words.on`. */
function EmbeddingWords({ id, words }: { id: string; words: string[] }) {
  const entry = useStore((s) => s.workflow.embeddings?.find((e) => e.id === id));
  if (!entry || !words.length) return null;
  const ws = { on: true, weight: 1, ...entry.words };
  const auto: AutoWords = { on: ws.on, set: (on) => useStore.getState().updateEmbedding(id, { words: { ...ws, on } }) };
  return <TriggerWords words={words} auto={auto} title="Trigger words · tap to add to the prompt" />;
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
        <Chip small onClick={() => updateLora(id, { strength: 1, clipStrength: 1 })} title="Strength 1.0 · CLIP 1.0">Defaults</Chip>
        <Chip small onClick={() => updateLora(id, { clipStrength: lora.strength })} title="Set CLIP strength to the model strength">CLIP = strength</Chip>
      </div>
    </>
  );
}

const BUILT_IN_VAE = '__builtin__';

function BaseCheckpointMore() {
  const vae = useStore((s) => s.workflow.vae);
  const vaes = useStore((s) => s.server.vaes);
  const setWorkflow = useStore((s) => s.setWorkflow);
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

function EmbeddingMore({ id }: { id: string }) {
  const entry = useStore((s) => s.workflow.embeddings?.find((e) => e.id === id));
  const updateEmbedding = useStore((s) => s.updateEmbedding);
  if (!entry) return null;
  const ws = { on: true, weight: 1, ...entry.words };
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Joins which prompt</span>
        <Tabs compact items={[{ key: 'positive', label: 'Positive' }, { key: 'negative', label: 'Negative' }]} value={entry.target} onChange={(target) => updateEmbedding(id, { target })} />
      </div>
      <SliderRow label="Trigger words weight" value={ws.weight} min={0} max={2} step={0.05} presets={[0.5, 0.8, 1, 1.2]} format={fmtWeight}
        onChange={(weight) => updateEmbedding(id, { words: { ...ws, weight } })} hint="Applies when Auto is on" />
    </>
  );
}

/** ControlNet: the guide image and the preprocessor. */
function ControlNetInput({ id }: { id: string }) {
  const entry = useControlnets((s) => s.entries.find((e) => e.id === id));
  const update = useControlnets((s) => s.update);
  const file = useRef<HTMLInputElement>(null);
  if (!entry) return null;
  const pick = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => update(id, { image: { dataUrl, name: f.name, width: img.naturalWidth, height: img.naturalHeight } satisfies ControlNetImage });
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <button type="button" onClick={() => file.current?.click()} aria-label={entry.image ? 'Change the guide image' : 'Add a guide image'}
        style={{ width: 88, height: 88, flex: 'none', border: entry.image ? 0 : '2px dashed var(--il-line-strong)', borderRadius: T.radius.lg, background: 'var(--il-elev)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 0, cursor: 'pointer' }}>
        {entry.image ? <img src={entry.image.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconPhotoPlus size={22} />}
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.image ? `${entry.image.name} · ${entry.image.width}×${entry.image.height}` : 'Guide image · tap the box'}
          </span>
          {entry.image && <button type="button" aria-label="Remove the guide image" onClick={() => update(id, { image: null })} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 2 }}><IconX size={14} /></button>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Preprocessor</span>
        <SearchSelect options={PREPROCESSORS.map((p) => ({ value: p, label: p === 'none' ? 'None (image as is)' : p }))} value={entry.preprocessor}
          onChange={(v) => update(id, { preprocessor: v as Preprocessor })} searchable={false} label="Preprocessor" />
      </div>
    </div>
  );
}
