/**
 * Settings → Sounds → Mixer (Donny 10-21: "a mixer … vertical sliders and a value at the bottom
 * that is editable … all in one row"). One narrow channel strip per action — ▶ (hear it), a
 * vertical fader, the short name, an editable % box — and the Master strip at the end, set apart
 * like a desk's master (light cap, its own panel). One row, never wrapped: when it does not fit
 * (phone) it scrolls sideways with an edge fade. A drag / key burst / wheel pause is one undo
 * step; double-click a fader resets it. Volumes are 0–100 % in the box and the bubble alike.
 */
import { useCallback, useState } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useSoundStore } from '@/lib/sounds';
import { IconBtn, useEdgeFade, useWheelSideways } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { pushUndo } from '~/app/undo';
import { parsePercent, SOUND_ACTIONS, type ActionDef } from '~/app/sounds/soundActions';
import { previewPick } from '~/app/sounds/soundEngine';
import { useSoundPicks } from '~/app/sounds/soundStore';
import { Fader } from './Fader';

const pct = (v: number) => Math.round(v * 100);
const fmt = (v: number) => `${Math.round(v)}%`;

/** The % box under a fader: type a number, Enter or leaving it commits, Escape puts it back. */
function ValueBox({ value, onCommit, label, width }: { value: number; onCommit: (v: number) => void; label: string; width: number }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const v = parsePercent(text);
    setText(null);
    if (v !== null && pct(v) !== value) onCommit(v);
  };
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={text ?? fmt(value)}
      onFocus={(e) => { setText(String(value)); requestAnimationFrame(() => e.target.select()); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); setText(null); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); }
        e.stopPropagation();
      }}
      data-sound="none"
      style={{
        width, height: 26, boxSizing: 'border-box', textAlign: 'center', padding: 0,
        border: '1px solid var(--il-line-soft)', borderRadius: 8, background: 'var(--il-bg-deep, var(--il-bg))',
        color: 'var(--il-fg)', font: 'inherit', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', outline: 'none',
      }}
    />
  );
}

function Strip({ name, title, value, defaultValue, onSet, onPlay, playable, height, width, master }: {
  name: string; title: string; value: number; defaultValue: number; onSet: (v01: number) => void;
  onPlay: (v01?: number) => void; playable: boolean; height: number; width: number; master?: boolean;
}) {
  const [start, setStart] = useState<number | null>(null);
  const v = pct(value);
  /** One undo entry per gesture (drag, key burst, wheel pause, typed value). */
  const record = (from: number, to: number, label = `${title} volume`) => {
    if (from === to) return;
    pushUndo({ label, undo: () => onSet(from / 100), redo: () => onSet(to / 100) });
  };
  return (
    <div style={{
      flex: `1 0 ${width}px`, maxWidth: master ? 64 : 56, minWidth: width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: master ? '8px 4px' : '8px 0', borderRadius: 12, boxSizing: 'border-box',
      background: master ? 'var(--il-card)' : 'transparent', border: master ? '1px solid var(--il-line-soft)' : '1px solid transparent',
      marginLeft: master ? 6 : 0,
    }}>
      <span data-sound="none" style={{ display: 'inline-flex' }}>
        <IconBtn icon={<IconPlayerPlay size={13} />} label={`Play ${title.toLowerCase()}`} size={28} tone="card" disabled={!playable} onClick={() => onPlay()} />
      </span>
      <Fader
        value={v} min={0} max={100} step={1} height={height} label={`${title} volume`} format={fmt} master={master}
        onChange={(n) => { if (start === null) setStart(v); onSet(n / 100); }}
        onChangeEnd={(n) => { record(start ?? n, n); setStart(null); if (playable) onPlay(n / 100); }}
        onReset={() => { const d = pct(defaultValue); if (d !== v) { onSet(defaultValue); record(v, d, `Reset ${title.toLowerCase()} volume`); } }}
      />
      <span title={title} style={{
        width: '100%', textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: -0.2, lineHeight: '12px', height: 12,
        color: master ? 'var(--il-fg)' : 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textTransform: master ? 'uppercase' : undefined,
      }}>{name}</span>
      <ValueBox value={v} width={Math.min(width - 2, 44)} label={`${title} volume`}
        onCommit={(n) => { onSet(n); record(v, pct(n)); if (playable) onPlay(n); }} />
    </div>
  );
}

function ActionStrip({ def, height, width, silent }: { def: ActionDef; height: number; width: number; silent: boolean }) {
  const pick = useSoundPicks((s) => s.picks[def.id]);
  const setVolume = useSoundPicks((s) => s.setVolume);
  return (
    <Strip name={def.short} title={def.label} value={pick.volume} defaultValue={def.volume} height={height} width={width}
      playable={!silent && !!pick.sound}
      onSet={(v) => setVolume(def.id, v)}
      onPlay={(v) => previewPick(def.id, pick.sound, v ?? useSoundPicks.getState().picks[def.id].volume)} />
  );
}

function MasterStrip({ height, width }: { height: number; width: number }) {
  const volume = useSoundStore((s) => s.volume);
  const muted = useSoundStore((s) => s.muted);
  const setVolume = useSoundStore((s) => s.setVolume);
  return (
    <Strip master name="Master" title="Master" value={volume} defaultValue={0.5} height={height} width={width}
      playable={!muted}
      onSet={setVolume}
      onPlay={() => { const d = useSoundPicks.getState().picks.done; previewPick('done', d.sound, d.volume); }} />
  );
}

export function SoundMixer() {
  const phone = useIsPhone();
  const silent = useSoundStore((s) => s.muted || s.volume <= 0);
  const fade = useEdgeFade<HTMLDivElement>();
  const wheel = useWheelSideways<HTMLDivElement>();
  const fadeRef = fade.ref;
  const ref = useCallback((el: HTMLDivElement | null) => { fadeRef(el); wheel(el); }, [fadeRef, wheel]);
  const height = phone ? 140 : 124;
  const width = phone ? 48 : 42;
  return (
    <div
      ref={ref}
      className="il-scroll"
      style={{
        width: '100%', display: 'flex', flexWrap: 'nowrap', gap: 1, overflowX: 'auto', overflowY: 'hidden',
        touchAction: 'pan-x', paddingBottom: 4, ...fade.style,
      }}
    >
      {SOUND_ACTIONS.map((a) => <ActionStrip key={a.id} def={a} height={height} width={width} silent={silent} />)}
      <MasterStrip height={height} width={phone ? 56 : 50} />
    </div>
  );
}
