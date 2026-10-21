/**
 * Settings → Sounds: the sound picker of one action (FIXLIST-2 "New UI sounds" + "synth sounds").
 * A button with the current sound's name; it opens a searchable list: "Theme sound" (follows the
 * theme, the default) and "None" on top, then every synth theme's sounds (Synth · Soft / Glass /
 * Pop, one per action), then Donny's pack grouped by folder. Each row has ▶ to hear it and a tap
 * on the name picks it. The pack's manifest loads when the list first opens (`useSoundPack`).
 */
import { useEffect, useRef, useState } from 'react';
import { Popover } from '@mantine/core';
import { IconCheck, IconPlayerPlay, IconVolumeOff } from '@tabler/icons-react';
import { Button, IconBtn, SearchField } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh, vw } from '~/theme/uiScale';
import { useIsPhone } from '~/app/useIsPhone';
import {
  groupSounds, labelOfId, SOUND_ACTIONS, SOUND_THEMES, SYNTH_THEME_IDS, synthId, THEME_SOUND,
  type PackFolder, type PackSound, type SoundAction,
} from '~/app/sounds/soundActions';
import { previewPick } from '~/app/sounds/soundEngine';
import { buildPatch } from '~/app/sounds/synthThemes';
import { patchLength } from '~/app/sounds/synthPatch';
import { useSoundPack } from '~/app/sounds/soundPack';

function Row({ label, sub, on, onPick, onPlay, phone }: {
  label: string; sub?: string; on: boolean; onPick: () => void; onPlay?: () => void; phone: boolean;
}) {
  const h = phone ? 40 : 32;
  return (
    <div data-on={on || undefined} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: h }}>
      {onPlay
        ? <span data-sound="none" style={{ display: 'inline-flex' }}><IconBtn icon={<IconPlayerPlay size={14} />} label="Play" size={h} onClick={onPlay} tooltip={false} /></span>
        : <span style={{ width: h, flex: 'none', display: 'grid', placeItems: 'center', color: 'var(--il-muted)' }}><IconVolumeOff size={14} /></span>}
      <button type="button" data-sound="none" onClick={onPick}
        style={{
          flex: 1, minWidth: 0, height: h, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', border: 0, borderRadius: T.radius.md,
          background: on ? 'var(--il-ember-soft)' : 'transparent', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)',
          fontSize: 12, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}
        className={on ? undefined : 'il-btn-ghost'}>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {sub && <span style={{ flex: 'none', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
        {on && <IconCheck size={14} stroke={2.6} style={{ flex: 'none' }} />}
      </button>
    </div>
  );
}

/** Every synth sound as a picker entry, one folder per theme (built once). */
let synthList: { sounds: PackSound[]; folders: PackFolder[] } | null = null;
function synthEntries() {
  if (synthList) return synthList;
  const folders = SYNTH_THEME_IDS.map((t) => ({ id: `synth:${t}`, label: `Synth · ${SOUND_THEMES.find((x) => x.id === t)?.label}` }));
  const sounds: PackSound[] = [];
  for (const t of SYNTH_THEME_IDS) {
    for (const a of SOUND_ACTIONS) {
      sounds.push({ id: synthId(t, a.id), folder: `synth:${t}`, label: a.label, duration: patchLength(buildPatch(t, a.id)) / 1000, path: '' });
    }
  }
  synthList = { sounds, folders };
  return synthList;
}

function List({ action, value, volume, onPick, phone }: { action: SoundAction; value: string | null; volume: number; onPick: (id: string | null) => void; phone: boolean }) {
  const pack = useSoundPack();
  const synth = synthEntries();
  const preview = (id: string) => previewPick(action, id, volume);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  // Open on the current pick.
  useEffect(() => {
    if (!pack) return;
    box.current?.querySelector('[data-on]')?.scrollIntoView({ block: 'center' });
  }, [pack]);
  const groups = [...groupSounds(synth.sounds, synth.folders, q), ...(pack ? groupSounds(pack.sounds, pack.folders, q) : [])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm }}>
      <SearchField value={q} onChange={setQ} placeholder="Search sounds" label="Search sounds" autoFocus={!phone} h={phone ? 40 : 32} />
      <div ref={box} className="il-scroll" style={{ maxHeight: `min(420px, calc(${dvh(100)} - 220px))`, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {!q && <Row label="Theme sound" on={value === THEME_SOUND} onPick={() => onPick(THEME_SOUND)} onPlay={() => preview(THEME_SOUND)} phone={phone} />}
        {!q && <Row label="None" on={value === null} onPick={() => onPick(null)} phone={phone} />}
        {pack && !groups.length && <div style={{ padding: 10, fontSize: 12, color: 'var(--il-muted)' }}>No match</div>}
        {groups.map((g) => (
          <section key={g.folder.id}>
            <div className="il-eyebrow" style={{ margin: '8px 4px 2px' }}>{g.folder.label}</div>
            {g.sounds.map((s) => (
              <Row key={s.id} label={s.label} sub={`${s.duration.toFixed(1)} s`} on={s.id === value} phone={phone}
                onPick={() => onPick(s.id)} onPlay={() => preview(s.id)} />
            ))}
          </section>
        ))}
        {!pack && <div style={{ padding: 10, fontSize: 12, color: 'var(--il-muted)' }}>Loading the pack…</div>}
      </div>
    </div>
  );
}

export function SoundPicker({ action, value, volume, onChange, label }: {
  action: SoundAction;
  value: string | null; volume: number; onChange: (id: string | null) => void;
  /** The action's name (aria). */
  label: string;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" withinPortal zIndex={T.z.popover}>
      <Popover.Target>
        <span data-sound="none" style={{ display: 'inline-flex', minWidth: 0, flex: '1 1 150px', maxWidth: phone ? undefined : 220 }}>
          <Button tone="card" size={phone ? 'lg' : 'sm'} caret grow onClick={() => setOpen((o) => !o)} aria-label={`${label} sound`}
            style={{ minWidth: 0, justifyContent: 'space-between', color: value ? undefined : 'var(--il-muted)' }}>
            <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelOfId(value)}</span>
          </Button>
        </span>
      </Popover.Target>
      <Popover.Dropdown style={{
        width: `min(360px, calc(${vw(100)} - 32px))`, background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)',
        borderRadius: T.radius.xl, padding: T.pad.panel,
      }}>
        {open && <List action={action} value={value} volume={volume} phone={phone} onPick={(id) => { onChange(id); setOpen(false); }} />}
      </Popover.Dropdown>
    </Popover>
  );
}
