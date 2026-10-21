/**
 * Settings → Sounds (FIXLIST-2 "New UI sounds" + "synth sounds"): the THEME on top (Soft / Glass /
 * Pop are synthesised live, Pack = the sample pack) with ▶ Play all (every action in turn, its
 * name shown), the master volume (0 = off, tap presets; a change plays the job-done sound after a
 * beat), mute (the top bar's MuteToggle is the same switch), whether the theme's motion setting
 * quiets the interface sounds, the MIXER (one vertical fader per action + Master, SoundMixer),
 * then one row per action: its sound (the theme's, another theme's, a pack sample or none;
 * SoundPicker) and ▶; and "Reset to defaults".
 * Master + mute = `@/lib/sounds` (shared with the classic app); the rest = `~/app/sounds/soundStore`.
 */
import { useEffect, useRef, useState } from 'react';
import { IconPlayerPlay, IconPlayerStop, IconRestore } from '@tabler/icons-react';
import { useSoundStore } from '@/lib/sounds';
import { Button, Chip, IconBtn, Row, Slider, Switch } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { DEFAULT_THEME, isDefaultPick, SOUND_ACTIONS, SOUND_THEMES, THEME_SOUND, type ActionDef, type SoundThemeId } from '~/app/sounds/soundActions';
import { loadPackDurations, previewPick, soundLengthMs, themeSound } from '~/app/sounds/soundEngine';
import { useSoundPicks } from '~/app/sounds/soundStore';
import { pushUndo } from '~/app/undo';
import { SoundPicker } from './SoundPicker';
import { SoundMixer } from './SoundMixer';
import type { SettingDef } from './categories';

const PRESETS = [0, 25, 50, 75, 100];
const fmt = (v: number) => (v === 0 ? 'Off' : `${v}%`);

function previewDone() {
  const done = useSoundPicks.getState().picks.done;
  previewPick('done', done.sound, done.volume);
}

/** The theme chips, ▶ Play all (Stop while it runs) and the name of the sound playing. */
function ThemeCtl() {
  const theme = useSoundPicks((s) => s.theme);
  const silent = useSoundStore((s) => s.muted || s.volume <= 0);
  const [at, setAt] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => { window.clearTimeout(timer.current); setAt(null); };
  useEffect(() => { loadPackDurations(); return () => window.clearTimeout(timer.current); }, []);
  const pick = (id: SoundThemeId) => {
    stop();
    const from = useSoundPicks.getState().theme;
    if (from === id) { previewTheme(id); return; }
    useSoundPicks.getState().setTheme(id);
    pushUndo({ label: 'Sound theme', undo: () => useSoundPicks.getState().setTheme(from), redo: () => useSoundPicks.getState().setTheme(id) });
    previewTheme(id);
  };
  const previewTheme = (id: SoundThemeId) => {
    const done = useSoundPicks.getState().picks.done;
    previewPick('done', THEME_SOUND, done.volume, id);
  };
  const playFrom = (i: number, id: SoundThemeId) => {
    if (i >= SOUND_ACTIONS.length) { setAt(null); return; }
    const a = SOUND_ACTIONS[i];
    const r = themeSound(a.id, id);
    setAt(i);
    if (r) previewPick(a.id, THEME_SOUND, useSoundPicks.getState().picks[a.id].volume, id);
    timer.current = window.setTimeout(() => playFrom(i + 1, id), r ? soundLengthMs(r) + 380 : 260);
  };
  const def = SOUND_THEMES.find((t) => t.id === theme);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Row wrap>
        {SOUND_THEMES.map((t) => <Chip key={t.id} on={t.id === theme} onClick={() => pick(t.id)}>{t.label}</Chip>)}
      </Row>
      <div style={{ display: 'flex', alignItems: 'center', gap: T.gap.md, flexWrap: 'wrap' }}>
        <span data-sound="none" style={{ display: 'inline-flex' }}>
          <Button tone={at === null ? 'card' : 'light'} size="sm" disabled={silent && at === null}
            icon={at === null ? <IconPlayerPlay size={14} /> : <IconPlayerStop size={14} />}
            onClick={() => (at === null ? playFrom(0, theme) : stop())}>
            {at === null ? 'Play all' : 'Stop'}
          </Button>
        </span>
        <span aria-live="polite" style={{ fontSize: 12, fontWeight: 700, color: at === null ? 'var(--il-muted)' : 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>
          {at === null ? def?.hint : `${SOUND_ACTIONS[at].label} · ${at + 1} / ${SOUND_ACTIONS.length}${themeSound(SOUND_ACTIONS[at].id, theme) ? '' : ' · silent here'}`}
        </span>
      </div>
    </div>
  );
}

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
    timer.current = window.setTimeout(previewDone, 400);
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
  const btn = phone ? 40 : 32;
  const choose = (id: string | null) => {
    const from = pick.sound;
    if (from === id) return;
    setSound(def.id, id);
    pushUndo({ label: `${def.label} sound`, undo: () => setSound(def.id, from), redo: () => setSound(def.id, id) });
    if (id && !silent) previewPick(def.id, id, pick.volume);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: T.gap.md, rowGap: 4, padding: '6px 0', borderTop: '1px solid var(--il-line-soft)' }}>
      <div style={{ flex: phone ? '1 1 100%' : '1 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg)' }}>{def.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{def.hint}</span>
      </div>
      <div style={{ flex: phone ? '1 1 100%' : '1 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: T.gap.sm, justifyContent: 'flex-end' }}>
        <SoundPicker action={def.id} value={pick.sound} volume={pick.volume} label={def.label} onChange={choose} />
        <span data-sound="none" style={{ display: 'inline-flex' }}>
          <IconBtn icon={<IconPlayerPlay size={14} />} label={`Play ${def.label.toLowerCase()}`} size={btn} tone="card"
            disabled={silent || !pick.sound} onClick={() => previewPick(def.id, pick.sound, pick.volume)} />
        </span>
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
  const theme = useSoundPicks((s) => s.theme);
  const changed = !follow || theme !== DEFAULT_THEME || SOUND_ACTIONS.some((a) => !isDefaultPick(a.id, picks[a.id]));
  const reset = () => {
    const before = useSoundPicks.getState();
    const old = { theme: before.theme, picks: before.picks, followMotion: before.followMotion };
    before.reset();
    pushUndo({ label: 'Reset sounds', undo: () => useSoundPicks.setState(old), redo: () => useSoundPicks.getState().reset() });
  };
  return <Button tone="card" size="sm" icon={<IconRestore size={14} />} disabled={!changed} onClick={reset}>Reset to defaults</Button>;
}

export const SOUNDS_ROWS: readonly SettingDef[] = [
  {
    id: 'sounds.theme', category: 'sounds', label: 'Sound theme', wide: true,
    hint: 'Pick the instrument for every sound.',
    keywords: ['theme', 'synth', 'soft', 'glass', 'pop', 'pack', 'samples', 'play all', 'demo', 'listen', 'preview'],
    Control: ThemeCtl,
  },
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
    id: 'sounds.mixer', category: 'sounds', label: 'Mixer', wide: true,
    hint: 'The volume of each sound.',
    keywords: ['mixer', 'fader', 'volume', 'level', 'loud', 'quiet', 'balance', 'master'],
    Control: SoundMixer,
  },
  {
    id: 'sounds.actions', category: 'sounds', label: 'Sound for each action', wide: true,
    hint: 'Pick the sound of each moment.',
    keywords: ['pick', 'choose', 'play', 'preview', 'test', 'pack', 'hover', 'click', 'toggle', 'tab', 'open', 'close', 'window', 'modal',
      'queued', 'done', 'job', 'download', 'success', 'favourite', 'favorite', 'copy', 'delete', 'undo', 'redo', 'warning', 'error', 'drop', 'drag'],
    Control: ActionsCtl,
  },
  {
    id: 'sounds.reset', category: 'sounds', label: 'Reset sounds', compact: true,
    hint: 'Theme, sounds and volumes back to their defaults.',
    keywords: ['reset', 'default', 'restore'], Control: ResetCtl,
  },
];
