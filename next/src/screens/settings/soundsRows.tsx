/**
 * Settings → Sounds (FIXLIST-2 "New UI sounds", replacing L1 #44's synthesised tones): the master
 * volume (0 = off, with tap presets; a change plays the job-done sound after a beat), mute (the top
 * bar's MuteToggle is the same switch), whether the theme's motion setting quiets the interface
 * sounds, then one row per action: a sound from Donny's pack (searchable picker grouped by folder,
 * ▶ in the list), ▶ to hear the pick, its own volume; and "Reset to defaults".
 * Master + mute = `@/lib/sounds` (shared with the classic app); the picks = `~/app/sounds/soundStore`.
 */
import { useEffect, useRef } from 'react';
import { IconPlayerPlay, IconRestore } from '@tabler/icons-react';
import { useSoundStore } from '@/lib/sounds';
import { Button, Chip, IconBtn, Row, Slider, Switch } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { isDefaultPick, SOUND_ACTIONS, type ActionDef } from '~/app/sounds/soundActions';
import { previewSound } from '~/app/sounds/soundEngine';
import { useSoundPicks } from '~/app/sounds/soundStore';
import { pushUndo } from '~/app/undo';
import { SoundPicker } from './SoundPicker';
import type { SettingDef } from './categories';

const PRESETS = [0, 25, 50, 75, 100];
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
    timer.current = window.setTimeout(() => {
      const done = useSoundPicks.getState().picks.done;
      if (done.sound) previewSound(done.sound, done.volume);
    }, 400);
  };
  const pct = Math.round(volume * 100);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Row wrap>{PRESETS.map((p) => <Chip key={p} small on={Math.abs(p - pct) < 2.5} onClick={() => change(p)}>{fmt(p)}</Chip>)}</Row>
      <Slider value={pct} min={0} max={100} step={5} onChange={change} aria-label="Volume" />
    </div>
  );
}

function MuteCtl() {
  const muted = useSoundStore((s) => s.muted);
  const setMuted = useSoundStore((s) => s.setMuted);
  return <Switch label="" checked={muted} onChange={setMuted} />;
}

function MotionCtl() {
  const on = useSoundPicks((s) => s.followMotion);
  const set = useSoundPicks((s) => s.setFollowMotion);
  return <Switch label="" checked={on} onChange={set} />;
}

function ActionRow({ def, silent, phone }: { def: ActionDef; silent: boolean; phone: boolean }) {
  const pick = useSoundPicks((s) => s.picks[def.id]);
  const setSound = useSoundPicks((s) => s.setSound);
  const setVolume = useSoundPicks((s) => s.setVolume);
  const btn = phone ? 40 : 32;
  const pct = Math.round(pick.volume * 100);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: T.gap.md, rowGap: 4, padding: '6px 0', borderTop: '1px solid var(--il-line-soft)' }}>
      <div style={{ flex: phone ? '1 1 100%' : '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg)' }}>{def.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{def.hint}</span>
      </div>
      <div style={{ flex: phone ? '1 1 100%' : '2 1 320px', minWidth: 0, display: 'flex', alignItems: 'center', gap: T.gap.sm }}>
        <SoundPicker value={pick.sound} volume={pick.volume} label={def.label} onChange={(id) => setSound(def.id, id)} />
        <span data-sound="none" style={{ display: 'inline-flex' }}>
          <IconBtn icon={<IconPlayerPlay size={14} />} label={`Play ${def.label.toLowerCase()}`} size={btn} tone="card"
            disabled={silent || !pick.sound} onClick={() => pick.sound && previewSound(pick.sound, pick.volume)} />
        </span>
        <div data-sound="none" style={{ flex: '1 1 90px', minWidth: 80, maxWidth: phone ? undefined : 150, opacity: pick.sound ? 1 : 0.4 }}>
          <Slider value={pct} min={0} max={100} step={5} disabled={!pick.sound} aria-label={`${def.label} volume`}
            format={(v) => `${v}%`} onChange={(v) => setVolume(def.id, v / 100)}
            onChangeEnd={(v) => { if (pick.sound && !silent) previewSound(pick.sound, v / 100); }}
            onReset={() => setVolume(def.id, def.volume)} />
        </div>
      </div>
    </div>
  );
}

function ActionsCtl() {
  const silent = useSoundStore((s) => s.muted || s.volume <= 0);
  const phone = useIsPhone();
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {SOUND_ACTIONS.map((a) => <ActionRow key={a.id} def={a} silent={silent} phone={phone} />)}
    </div>
  );
}

function ResetCtl() {
  const picks = useSoundPicks((s) => s.picks);
  const follow = useSoundPicks((s) => s.followMotion);
  const changed = !follow || SOUND_ACTIONS.some((a) => !isDefaultPick(a.id, picks[a.id]));
  const reset = () => {
    const before = useSoundPicks.getState();
    const old = { picks: before.picks, followMotion: before.followMotion };
    before.reset();
    pushUndo({ label: 'Reset sounds', undo: () => useSoundPicks.setState(old), redo: () => useSoundPicks.getState().reset() });
  };
  return <Button tone="card" size="sm" icon={<IconRestore size={14} />} disabled={!changed} onClick={reset}>Reset to defaults</Button>;
}

export const SOUNDS_ROWS: readonly SettingDef[] = [
  {
    id: 'sounds.volume', category: 'sounds', label: 'Volume', wide: true,
    hint: 'The volume of every app sound.',
    keywords: ['master', 'mute', 'off', 'chime', 'notification', 'audio', 'loud', 'quiet'],
    Control: VolumeCtl, Value: VolumeValue,
  },
  {
    id: 'sounds.mute', category: 'sounds', label: 'Mute', compact: true,
    hint: 'Silence every sound, keeping the volume.',
    keywords: ['mute', 'silent', 'quiet', 'off', 'speaker'], Control: MuteCtl,
  },
  {
    id: 'sounds.motion', category: 'sounds', label: 'Follow motion setting', compact: true,
    hint: 'Motion off quiets the interface sounds; subtle quiets hover.',
    keywords: ['motion', 'reduced', 'animation', 'quiet', 'hover', 'click', 'theme'], Control: MotionCtl,
  },
  {
    id: 'sounds.actions', category: 'sounds', label: 'Sound for each action', wide: true,
    hint: 'Pick a sound and a volume for each moment.',
    keywords: ['pick', 'choose', 'play', 'preview', 'test', 'pack', 'hover', 'click', 'toggle', 'tab', 'open', 'close', 'window', 'modal',
      'queued', 'done', 'job', 'download', 'success', 'favourite', 'favorite', 'copy', 'delete', 'undo', 'redo', 'warning', 'error', 'drop', 'drag'],
    Control: ActionsCtl,
  },
  {
    id: 'sounds.reset', category: 'sounds', label: 'Reset sounds', compact: true,
    hint: 'Every action back to its default sound and volume.',
    keywords: ['reset', 'default', 'restore'], Control: ResetCtl,
  },
];
