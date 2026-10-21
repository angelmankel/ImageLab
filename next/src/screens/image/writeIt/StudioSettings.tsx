/**
 * Item 37: the studio's "AI settings" — grouped and compact. Model; System prompt (preset chips:
 * Stock + your own, "Edit" opens a roomy editor, back to stock); Creativity (Temperature as one
 * Safe ↔ Wild slider); "More parameters" folded, one compact row each (hint on hover). No
 * nested scroll: this sits in the right column, which is the only scroller.
 */
import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconChevronRight, IconPencil, IconPlus, IconRestore, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { activeEntry, providerSpec } from '@/lib/aiProviders';
import { providerParams, type AiParamSpec } from '@/lib/aiParams';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, Chip, NumberField, Slider, Tip } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh } from '~/theme/uiScale';
import { creativityLabel, stockStudioSystem } from './studioLogic';
import { useWriteIt, type SystemPreset } from './writeItStore';

const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--il-muted)' };
const note: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--il-dim)' };
const group: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--il-card)' };
const fmt = (p: AiParamSpec) => (n: number) => (p.int ? String(Math.round(n)) : String(Number(n.toFixed(2))));

/** The system prompt the studio sends now. */
export function activeSystem(promptStyle: 'sdxl' | 'illustrious'): string {
  const w = useWriteIt.getState();
  const p = w.presets.find((x) => x.id === w.presetId);
  return p?.text.trim() || stockStudioSystem(promptStyle);
}

function PresetEditor({ preset, onClose }: { preset: SystemPreset | null; onClose: () => void }) {
  const phone = useIsPhone();
  const ai = useStore((s) => s.ai);
  const presets = useWriteIt((s) => s.presets);
  const savePreset = useWriteIt((s) => s.savePreset);
  const deletePreset = useWriteIt((s) => s.deletePreset);
  const stock = stockStudioSystem(ai.promptStyle);
  const isNew = !preset || preset.id === 'stock';
  const [name, setName] = useState(isNew ? `My preset ${presets.length + 1}` : preset!.name);
  const [text, setText] = useState(isNew ? stock : preset!.text);
  const size = phone ? 'lg' : 'md';
  return (
    <Modal opened onClose={onClose} withCloseButton={false} centered size={860} fullScreen={phone} zIndex={T.z.modal + 20} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.4 }} styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)' } }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: phone ? 14 : 18, height: phone ? dvh(100) : `min(680px, ${dvh(86)})`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{isNew ? 'New system prompt' : 'Edit system prompt'}</span>
          {text.trim() !== stock && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} onClick={() => setText(stock)}>Reset to stock</Button>}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Preset name" placeholder="Name"
          style={{ height: phone ? 44 : 36, border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', padding: '0 12px', fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="System prompt" autoFocus
          style={{ flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', border: '1px solid var(--il-line-soft)', borderRadius: 14, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 13, lineHeight: 1.6, padding: '12px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
        <span style={note}>How the AI is told to write. Keep "answer with the prompt only" so the reply is just the prompt.</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isNew && <Button tone="danger" size={size} icon={<IconTrash size={14} />} onClick={() => { deletePreset(preset!.id); onClose(); }}>Delete</Button>}
          <div style={{ flex: 1 }} />
          <Button tone="card" size={size} onClick={onClose}>Cancel</Button>
          <Button tone="primary" size={size} disabled={!text.trim()} onClick={() => {
            savePreset({ id: isNew ? `p${Date.now().toString(36)}` : preset!.id, name: name.trim() || 'My preset', text });
            onClose();
          }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

export function StudioSettings() {
  const phone = useIsPhone();
  const ai = useStore((s) => s.ai);
  const provider = activeEntry(ai).id;
  const presets = useWriteIt((s) => s.presets);
  const presetId = useWriteIt((s) => s.presetId);
  const setPresetId = useWriteIt((s) => s.setPresetId);
  const values = useWriteIt((s) => s.params[provider]);
  const setParam = useWriteIt((s) => s.setParam);
  const resetParams = useWriteIt((s) => s.resetParams);
  const more = useWriteIt((s) => s.moreParams);
  const setMore = useWriteIt((s) => s.setMoreParams);
  const [editing, setEditing] = useState<SystemPreset | null | false>(false);

  const specs = providerParams(provider);
  const temp = specs.find((p) => p.id === 'temperature');
  const rest = specs.filter((p) => p.id !== 'temperature');
  const changed = rest.filter((p) => typeof values?.[p.id] === 'number').length;
  const current = presets.find((p) => p.id === presetId) ?? null;
  const t = typeof values?.temperature === 'number' ? values.temperature : temp?.default ?? 0.85;
  const btn = phone ? 'lg' : 'sm';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={group}>
        <span style={eyebrow}>Model · {providerSpec(provider).name}</span>
        <AiModelPicker size={phone ? 'md' : 'sm'} />
        <span style={note}>Providers and keys live in Settings → AI helper.</span>
      </div>

      <div style={group}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...eyebrow, flex: 1 }}>System prompt</span>
          <Button tone="card" size={btn} icon={<IconPencil size={13} />} onClick={() => setEditing(current ?? { id: 'stock', name: 'Stock', text: '' })} tooltip={current ? 'Edit this preset' : 'Make your own'}>Edit</Button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip tall={phone} on={!current} onClick={() => setPresetId('stock')}>Stock</Chip>
          {presets.map((p) => <Chip key={p.id} tall={phone} on={p.id === presetId} onClick={() => setPresetId(p.id)}>{p.name}</Chip>)}
          <Chip tall={phone} dashed icon={<IconPlus size={12} stroke={2.6} />} onClick={() => setEditing(null)}>New</Chip>
        </div>
        <span style={note}>{current ? 'Your own instructions for the AI.' : 'The built-in instructions. Follows your prompt style (SDXL / Illustrious).'}</span>
      </div>

      {temp && (
        <div style={group}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tip label={temp.hint} multiline w={260}><span style={{ ...eyebrow, flex: 1, cursor: 'help' }}>Creativity</span></Tip>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>{creativityLabel(t, temp.max)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(temp)(t)}</span>
            {typeof values?.temperature === 'number' && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} tooltip="Back to default" onClick={() => setParam(provider, 'temperature', undefined)} />}
          </div>
          <Slider value={t} min={temp.min} max={temp.max} step={temp.step} onChange={(n) => setParam(provider, 'temperature', n)} aria-label="Creativity" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}><span>← Safe</span><span>Wild →</span></div>
        </div>
      )}

      {rest.length > 0 && (
        <div style={group}>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'inherit', minHeight: phone ? 40 : 24 }}>
            <IconChevronRight size={14} stroke={2.6} style={{ color: 'var(--il-muted)', transform: more ? 'rotate(90deg)' : undefined, transition: 'transform var(--il-dur, .15s)' }} />
            <span style={eyebrow}>More parameters</span>
            {changed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-ember-hi)' }}>· {changed} changed</span>}
            <div style={{ flex: 1 }} />
          </button>
          {more && (
            <>
              {rest.map((p) => {
                const v = values?.[p.id];
                const set = typeof v === 'number';
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: phone ? '1fr auto 40px' : '128px 1fr auto 30px', alignItems: 'center', gap: 8, minHeight: phone ? 44 : 32 }}>
                    <Tip label={p.hint} multiline w={260}><span style={{ fontSize: 12, fontWeight: 700, color: set ? 'var(--il-fg)' : 'var(--il-fg2)', cursor: 'help', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span></Tip>
                    {!phone && <Slider value={set ? v : p.default} min={p.min} max={p.max} step={p.step} onChange={(n) => setParam(provider, p.id, n)} aria-label={p.label} />}
                    <NumberField value={set ? v : p.default} onChange={(n) => setParam(provider, p.id, n)} min={p.min} max={p.max} step={p.step} label={p.label} format={fmt(p)} size={phone ? 'lg' : 'sm'} width={phone ? 140 : 96} />
                    <span>{set && <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconRestore size={13} />} tooltip="Back to default" onClick={() => setParam(provider, p.id, undefined)} />}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={note}>Unset = the provider's default. Hover a name for what it does.</span>
                <div style={{ flex: 1 }} />
                {(changed > 0 || typeof values?.temperature === 'number') && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} onClick={() => resetParams(provider)}>All to default</Button>}
              </div>
            </>
          )}
        </div>
      )}

      {editing !== false && <PresetEditor preset={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}
