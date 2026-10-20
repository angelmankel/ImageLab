/**
 * The selected entry (rule 4): picture, name, Change ▾, CivitAI ↗, On/Off, trigger words as
 * tap-to-add chips, Strength with tap presets + slider, "More" (CLIP strength, defaults, per-kind
 * extras), Remove. One card for every kind; the kind decides which parts show.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Select } from '@mantine/core';
import { IconChevronDown, IconExternalLink, IconPhotoPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { embeddingWords } from '@/lib/embeddings';
import { modelKeywordState } from '@/lib/modelKeywords';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { modelLabel } from '@/components/models/modelInfo';
import { Chip, SliderRow, Switch, Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { Thumb } from './Thumb';
import { TriggerWords, type AutoWords } from './TriggerWords';
import { metaLine, useModelMeta } from './useModelMeta';
import { metaWithPending } from './pendingLogic';
import { PendingStrip } from './PendingStrip';
import { openModelViewer } from './viewerBridge';
import { fmtWeight, type KindApi, type ModelEntry } from './kinds';
import { PREPROCESSORS, useControlnets, type ControlNetImage, type Preprocessor } from './controlnetStore';

const SELECT_STYLES = {
  input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 700, fontSize: 12, height: 32, minHeight: 32 },
  dropdown: { background: 'var(--il-panel)', borderColor: 'var(--il-line-soft)' },
  option: { fontSize: 12, fontWeight: 600 },
};

function ActionPill({ children, onClick, tone = 'card', title, disabled }: { children: ReactNode; onClick?: () => void; tone?: 'card' | 'ghost' | 'danger'; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        height: 30, padding: '0 10px', border: 0, borderRadius: 999, cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: 11,
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1,
        background: tone === 'card' ? 'var(--il-card-on)' : tone === 'danger' ? 'color-mix(in srgb, var(--il-err) 14%, transparent)' : 'transparent',
        color: tone === 'danger' ? 'var(--il-err)' : tone === 'card' ? 'var(--il-fg)' : 'var(--il-muted)',
      }}
    >
      {children}
    </button>
  );
}

export function EntryCard({ entry, api, onChange }: { entry: ModelEntry; api: KindApi; onChange: () => void }) {
  const meta = metaWithPending(useModelMeta(entry.name), entry.pending);
  const [more, setMore] = useState(false);
  const { kind, spec } = api;
  const showWeight = !(kind === 'checkpoint' && entry.isBase);
  const pending = entry.pending;

  return (
    <div style={{ border: `1px ${pending ? 'dashed' : 'solid'} var(--il-line-strong)`, borderRadius: T.radius.xl, background: 'var(--il-card)', padding: T.pad.card, display: 'flex', flexDirection: 'column', gap: 14, opacity: entry.on && !pending ? 1 : 0.8 }}>
      {pending && <PendingStrip record={pending} />}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={() => void openModelViewer({ file: entry.name })} aria-label={`Open ${meta.name ?? meta.label} full screen`} title="Open full screen"
          style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', flex: 'none', borderRadius: T.radius.lg, opacity: pending ? 0.6 : 1 }}>
          <Thumb label={meta.label} images={meta.images} size={88} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }} title={entry.name}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.name ?? meta.label}</span>
            {pending && <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', background: 'var(--il-card-on)', color: 'var(--il-muted)' }}>not downloaded</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--il-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.name}>
            {metaLine(meta)}{meta.name && meta.name !== meta.label ? ` · ${meta.label}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionPill onClick={onChange} title={`Pick another ${spec.one}`}>Change <IconChevronDown size={13} stroke={2.6} /></ActionPill>
            <ActionPill onClick={() => meta.civitaiUrl && window.open(meta.civitaiUrl, '_blank', 'noopener')} disabled={!meta.civitaiUrl} title={meta.civitaiUrl ? 'Open on CivitAI' : 'Not on CivitAI'}>CivitAI <IconExternalLink size={13} stroke={2.4} /></ActionPill>
            {spec.hasSwitch && (
              <span style={{ marginLeft: 'auto' }}>
                <Switch label={entry.on ? 'On' : 'Off'} checked={entry.on} onChange={(on) => api.setOn(entry.id, on)} />
              </span>
            )}
          </div>
        </div>
      </div>

      {kind === 'checkpoint' && <ModelWords file={entry.name} words={meta.trainedWords} />}
      {kind === 'lora' && <ModelWords file={entry.name} words={meta.trainedWords} />}
      {kind === 'embedding' && <EmbeddingWords id={entry.id} words={embeddingWords(meta.trainedWords)} />}
      {kind === 'controlnet' && <ControlNetInput id={entry.id} />}

      {showWeight && (
        <SliderRow label={spec.weight.label} value={entry.weight} min={spec.weight.min} max={spec.weight.max} step={spec.weight.step}
          presets={spec.weight.presets} format={fmtWeight} onChange={(v) => api.setWeight(entry.id, v)}
          hint={kind === 'checkpoint' ? 'How much of this model blends into the base' : undefined} />
      )}

      {more && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 }}>
          {kind === 'lora' && <LoraMore id={entry.id} />}
          {kind === 'checkpoint' && entry.isBase && <BaseCheckpointMore />}
          {kind === 'checkpoint' && !entry.isBase && <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>Merged into the base with ModelMergeSimple at the ratio above.</span>}
          {kind === 'embedding' && <EmbeddingMore id={entry.id} />}
          {kind === 'controlnet' && <span style={{ fontSize: 11, color: 'var(--il-muted)' }}>ControlNet runs when the graph builder takes these entries; until then they are saved with the step.</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <ActionPill tone="ghost" onClick={() => setMore((v) => !v)}>
          {more ? 'Less' : `More · ${MORE_HINT[kind]}`} <IconChevronDown size={13} stroke={2.6} style={{ transform: more ? 'rotate(180deg)' : undefined }} />
        </ActionPill>
        <ActionPill tone="danger" onClick={() => api.remove(entry.id)}>Remove</ActionPill>
      </div>
    </div>
  );
}

const MORE_HINT: Record<KindApi['kind'], string> = {
  checkpoint: 'VAE, model type',
  lora: 'CLIP strength, defaults',
  embedding: 'prompt side, trigger words',
  controlnet: 'notes',
};

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
        <Select data={options} value={vae || BUILT_IN_VAE} onChange={(v) => setWorkflow({ vae: !v || v === BUILT_IN_VAE ? '' : v })} allowDeselect={false} size="xs" radius="md"
          comboboxProps={{ withinPortal: true, zIndex: T.z.popover }} styles={SELECT_STYLES} aria-label="VAE" />
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
        <Select data={PREPROCESSORS.map((p) => ({ value: p, label: p === 'none' ? 'None (image as is)' : p }))} value={entry.preprocessor}
          onChange={(v) => v && update(id, { preprocessor: v as Preprocessor })} allowDeselect={false} size="xs" radius="md"
          comboboxProps={{ withinPortal: true, zIndex: T.z.popover }} styles={SELECT_STYLES} aria-label="Preprocessor" />
      </div>
    </div>
  );
}
