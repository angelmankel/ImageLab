/**
 * Settings → Sounds: the volume of the "queued" blip and the "done" chime (0 = off), with a
 * preview of each. Logic = `@/lib/sounds` (stored in this browser).
 */
import { useEffect, useRef } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { playCompleteSound, playSubmitSound, useSoundStore } from '@/lib/sounds';
import { Chip, Row, SliderRow } from '~/ui';
import { SettingsCard } from './SettingsCard';

export function SoundsCard() {
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
    <SettingsCard title="Sounds" description="A blip when a job is queued, a chime when it is done.">
      <SliderRow label="Volume" value={pct} min={0} max={100} step={5} onChange={change} presets={[0, 25, 50, 100]} format={(v) => (v === 0 ? 'Off' : `${v}%`)} />
      <Row>
        <Chip small disabled={!pct} onClick={playSubmitSound} icon={<IconPlayerPlay size={12} />}>Queued</Chip>
        <Chip small disabled={!pct} onClick={playCompleteSound} icon={<IconPlayerPlay size={12} />}>Done</Chip>
      </Row>
    </SettingsCard>
  );
}
