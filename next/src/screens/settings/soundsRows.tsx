/**
 * Settings → Sounds: the volume of the "queued" blip and the "done" chime (0 = off, with tap
 * presets; a change plays the chime after a beat) and a preview of each. Logic = `@/lib/sounds`
 * (stored in this browser).
 */
import { useEffect, useRef } from 'react';
import { Slider } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { playCompleteSound, playSubmitSound, useSoundStore } from '@/lib/sounds';
import { Chip, Row } from '~/ui';
import type { SettingDef } from './categories';

const PRESETS = [0, 25, 50, 100];
const fmt = (v: number) => (v === 0 ? 'Off' : `${v}%`);

function VolumeValue() {
  const volume = useSoundStore((s) => s.volume);
  return <>{fmt(Math.round(volume * 100))}</>;
}

function VolumeCtl() {
  const volume = useSoundStore((s) => s.volume);
  const setVolume = useSoundStore((s) => s.setVolume);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const change = (pct: number) => {
    setVolume(pct / 100);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(playCompleteSound, 400);
  };
  const pct = Math.round(volume * 100);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Row wrap>{PRESETS.map((p) => <Chip key={p} small on={Math.abs(p - pct) < 2.5} onClick={() => change(p)}>{fmt(p)}</Chip>)}</Row>
      <Slider value={pct} min={0} max={100} step={5} onChange={change} label={null} size="sm" color="ember" aria-label="Volume"
        styles={{ track: { touchAction: 'pan-y' }, thumb: { touchAction: 'none', borderWidth: 2 } }} />
    </div>
  );
}

function PreviewCtl() {
  const volume = useSoundStore((s) => s.volume);
  const off = Math.round(volume * 100) === 0;
  return (
    <Row>
      <Chip small disabled={off} onClick={playSubmitSound} icon={<IconPlayerPlay size={12} />}>Queued</Chip>
      <Chip small disabled={off} onClick={playCompleteSound} icon={<IconPlayerPlay size={12} />}>Done</Chip>
    </Row>
  );
}

export const SOUNDS_ROWS: readonly SettingDef[] = [
  {
    id: 'sounds.volume', category: 'sounds', label: 'Volume', wide: true,
    hint: 'The blip when a job is queued and the chime when it is done. Off at zero.',
    keywords: ['mute', 'off', 'chime', 'blip', 'notification', 'audio', 'loud', 'quiet'],
    Control: VolumeCtl, Value: VolumeValue,
  },
  {
    id: 'sounds.preview', category: 'sounds', label: 'Preview', compact: true,
    hint: 'Hear each sound at the volume above.',
    keywords: ['play', 'test', 'queued', 'done', 'chime', 'blip'], Control: PreviewCtl,
  },
];
