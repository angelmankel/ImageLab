/**
 * The low-noise half of a Wan LoRA card (rule 4, Donny 10-20: both files of a high/low pair in
 * the same component). Sits under the card's strength slider: "Low noise" — the file's picture,
 * name, Change ▾ (the big models modal, LoRA + Wan base models) and ✕, its own strength
 * (`strengthLow`; "Same as high" until moved), its own pending strip while it downloads. Without
 * a low file: a dashed "+ Pick the low-noise file". State is the main app's `videoStore`.
 */
import { useState } from 'react';
import { IconChevronDown, IconPlus, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { Chip, SliderRow } from '~/ui';
import {
  ModelsModalBridge, PendingStrip, MissingStrip, Thumb, useModelMeta, metaLine, metaWithPending, usePendingModels, pendingKey, isMissing, openModelViewer, fmtWeight,
} from '~/screens/image/model';
import { WAN_BASE_MODELS } from './videoKinds';
import { clearLowFile, pickWanLora } from './wanLoraPick';
import { muted, pillBtn } from './bits';

const PRESETS = [0.5, 0.8, 1, 1.2];
const NO_FILES: string[] = Object.freeze([]) as unknown as string[];

export function WanLowSlot({ id }: { id: string }) {
  const lora = useVideo((s) => s.loras.find((l) => l.id === id));
  const serverLoras = useStore((s) => s.server.loras) ?? NO_FILES;
  const nameLow = lora?.nameLow ?? '';
  const record = usePendingModels((s) => (nameLow ? s.records[pendingKey('lora', nameLow)] : undefined));
  const meta = metaWithPending(useModelMeta(nameLow), record);
  const [picking, setPicking] = useState(false);
  // A lone low-noise file is the entry's main file already: nothing to add under it.
  if (!lora || (!nameLow && lora.expert === 'low')) return null;

  const update = (p: Partial<typeof lora>) => useVideo.getState().updateLora(id, p);
  const missing = !!nameLow && !record && isMissing(serverLoras, nameLow, 'lora');
  const same = lora.strengthLow == null;
  const strengthLow = lora.strengthLow ?? lora.strength;
  const dim = !!record || missing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: '1px solid var(--il-line)' }}>
      <span className="il-eyebrow">Low noise</span>
      {nameLow ? (
        <>
          {record && <PendingStrip record={record} />}
          {missing && <MissingStrip file={nameLow} />}
          <div style={{ display: 'flex', gap: 12, opacity: dim ? 0.8 : 1 }}>
            <button type="button" onClick={() => void openModelViewer({ file: nameLow })} aria-label={`Open ${meta.name ?? meta.label} full screen`} title="Open full screen"
              style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', flex: 'none', opacity: dim ? 0.6 : 1 }}>
              <Thumb label={meta.label || '?'} images={meta.images} size={64} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={nameLow}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.name ?? meta.label}</span>
                {record && <span style={{ flex: 'none', fontSize: 9, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', background: 'var(--il-card-on)', color: 'var(--il-muted)' }}>not downloaded</span>}
              </div>
              <div style={{ ...muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nameLow}>
                {metaLine(meta)}{meta.name && meta.name !== meta.label ? ` · ${meta.label}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <button type="button" style={pillBtn} onClick={() => setPicking(true)} title="Pick another low-noise file">Change <IconChevronDown size={13} stroke={2.6} /></button>
                <button type="button" onClick={() => clearLowFile(id)} aria-label="Drop the low-noise file" title="Drop the low-noise file"
                  style={{ ...pillBtn, width: 30, padding: 0, justifyContent: 'center', background: 'transparent', color: 'var(--il-muted)' }}>
                  <IconX size={14} stroke={2.6} />
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip small on={same} onClick={() => update({ strengthLow: null })} title="The low-noise file follows the high strength">Same as high</Chip>
          </div>
          <SliderRow label="Strength · low" value={strengthLow} min={0} max={2} step={0.05} presets={PRESETS} format={fmtWeight}
            onChange={(strengthLow) => update({ strengthLow })} hint={same ? `Follows the high strength (${fmtWeight(lora.strength)}) until you move it` : undefined} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex' }}>
            <Chip dashed icon={<IconPlus size={13} stroke={2.8} />} onClick={() => setPicking(true)}>Pick the low-noise file</Chip>
          </div>
          <span style={muted}>
            {lora.expert === 'both'
              ? 'This one file patches both experts. A Wan 2.2 pair has a second, low-noise file: pick it and each expert gets its own.'
              : 'The high-noise file alone. Pick its low-noise half and the pair patches both experts.'}
          </span>
        </>
      )}
      <ModelsModalBridge
        opened={picking}
        onClose={() => setPicking(false)}
        kind="lora"
        baseModels={WAN_BASE_MODELS}
        title="Pick the low-noise file"
        onPick={(pick) => { pickWanLora({ mode: 'low', id }, pick); setPicking(false); }}
        fallback={{ files: serverLoras, selected: nameLow ? [nameLow] : NO_FILES }}
      />
    </div>
  );
}
