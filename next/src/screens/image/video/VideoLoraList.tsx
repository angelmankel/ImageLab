/**
 * The Video step's LoRAs (rule 4's list, sized for video): one card per LoRA with On/Off, the
 * expert it patches (Wan: High · Low · Both), Strength with tap presets + slider, Remove; a dashed
 * "+ Add LoRA" opens the file picker over the video server's LoRA list (the engine's own files
 * first). State is the main app's `videoStore` (Wan `loras`, H3 `h3.loras`).
 */
import { useState } from 'react';
import { IconX, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { Chip, SliderRow, Switch, Tabs } from '~/ui';
import { FilePickerModal } from './FilePicker';
import { shortFile } from './videoStepLogic';
import { Warn, card, muted } from './bits';

const PRESETS = [0.5, 0.8, 1, 1.2];

export function VideoLoraList() {
  const v = useVideo();
  const serverLoras = useStore((s) => s.server.loras);
  const [adding, setAdding] = useState(false);
  const h3 = v.engine === 'h3';
  const list = h3 ? v.h3.loras : v.loras;
  const names = list.map((l) => l.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((l) => {
        const wan = h3 ? null : v.loras.find((x) => x.id === l.id)!;
        const missing = serverLoras.length > 0 && !serverLoras.includes(l.name);
        const update = (p: { on?: boolean; strength?: number }) => (h3 ? v.updateH3Lora(l.id, p) : v.updateLora(l.id, p));
        return (
          <div key={l.id} style={{ ...card, opacity: l.on ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.name}>{shortFile(l.name)}</span>
              <button type="button" aria-label={`Remove ${l.name}`} onClick={() => (h3 ? v.removeH3Lora(l.id) : v.removeLora(l.id))}
                style={{ width: 28, height: 28, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={13} stroke={2.4} /></button>
            </div>
            {missing && <Warn>not on the server</Warn>}
            <Switch label="On" checked={l.on} onChange={(on) => update({ on })} />
            {wan && (
              <Tabs<'high' | 'low' | 'both'> compact items={[{ key: 'high', label: 'High noise' }, { key: 'low', label: 'Low noise' }, { key: 'both', label: 'Both' }]} value={wan.expert} onChange={(expert) => v.updateLora(l.id, { expert })} />
            )}
            <SliderRow label={wan?.expert === 'both' && wan.strengthLow != null ? 'Strength · high' : 'Strength'} value={l.strength} min={0} max={2} step={0.05} presets={PRESETS} format={(x) => x.toFixed(2)} onChange={(strength) => update({ strength })} />
            {wan?.expert === 'both' && (
              <>
                <Switch label="Own strength on the low-noise expert" checked={wan.strengthLow != null} onChange={(on) => v.updateLora(l.id, { strengthLow: on ? wan.strength : null })} />
                {wan.strengthLow != null && <SliderRow label="Strength · low" value={wan.strengthLow} min={0} max={2} step={0.05} presets={PRESETS} format={(x) => x.toFixed(2)} onChange={(strengthLow) => v.updateLora(l.id, { strengthLow })} />}
              </>
            )}
          </div>
        );
      })}
      {!list.length && <div style={muted}>{h3 ? 'MiniMax H3 LoRAs go on the one model.' : 'Wan 2.2 LoRAs come as a high-noise and a low-noise file; a name that says which starts on that expert.'}</div>}
      <div><Chip dashed icon={<IconPlus size={13} stroke={2.6} />} onClick={() => setAdding(true)}>Add LoRA</Chip></div>
      <FilePickerModal opened={adding} onClose={() => setAdding(false)} title="Add a LoRA" files={serverLoras} engine={v.engine} current={names}
        onPick={(name) => { if (names.includes(name)) return; if (h3) v.addH3Lora(name); else v.addLora(name); }} />
    </div>
  );
}
