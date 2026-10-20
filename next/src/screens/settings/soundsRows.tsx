/**
 * Settings → Sounds (item 44): mute, the volume (0 = off, with tap presets; a change plays the
 * chime after a beat), and each kind on / off with a ▶ preview (queued, done, success, error,
 * click, toggle, hover). Logic = `@/lib/sounds` (stored in this browser; the top bar's
 * MuteToggle is the same `muted`).
 */
import { useEffect, useRef } from 'react';
import { Slider } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { playCompleteSound, playSound, SOUND_KINDS, useSoundStore } from '@/lib/sounds';
import { Chip, IconBtn, Row, Switch } from '~/ui';
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

function MuteCtl() {
  const muted = useSoundStore((s) => s.muted);
  const setMuted = useSoundStore((s) => s.setMuted);
  return <Switch label="" checked={muted} onChange={setMuted} />;
}

function KindsCtl() {
  const kinds = useSoundStore((s) => s.kinds);
  const setKind = useSoundStore((s) => s.setKind);
  const silent = useSoundStore((s) => s.muted || s.volume <= 0);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {SOUND_KINDS.map((k) => (
        <div key={k.kind} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
          <IconBtn icon={<IconPlayerPlay size={14} />} label={`Hear “${k.label}”`} size={32} tone="card" disabled={silent || !kinds[k.kind]}
            onClick={() => playSound(k.kind, { on: true })} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg)' }}>{k.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{k.hint}</span>
          </div>
          <Switch label="" checked={kinds[k.kind] !== false} onChange={(on) => setKind(k.kind, on)} />
        </div>
      ))}
    </div>
  );
}

export const SOUNDS_ROWS: readonly SettingDef[] = [
  {
    id: 'sounds.volume', category: 'sounds', label: 'Volume', wide: true,
    hint: 'All app sounds: the queued blip, the done chime, clicks and toggles. Off at zero.',
    keywords: ['mute', 'off', 'chime', 'blip', 'notification', 'audio', 'loud', 'quiet'],
    Control: VolumeCtl, Value: VolumeValue,
  },
  {
    id: 'sounds.mute', category: 'sounds', label: 'Mute', compact: true,
    hint: 'Silence every sound and keep the volume. Same as the speaker button at the top right.',
    keywords: ['mute', 'silent', 'quiet', 'off', 'speaker'], Control: MuteCtl,
  },
  {
    id: 'sounds.kinds', category: 'sounds', label: 'Which sounds', wide: true,
    hint: 'Each sound on or off; ▶ plays it at the volume above.',
    keywords: ['play', 'test', 'queued', 'done', 'chime', 'blip', 'hover', 'click', 'toggle', 'error', 'success', 'feedback'], Control: KindsCtl,
  },
];
