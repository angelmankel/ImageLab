/**
 * A file picker for the Video step's model rows and LoRAs: a row showing the chosen file (and
 * "not on the server" when the list lacks it), tap = a window listing the server's files, the
 * engine's own files first (Wan or H3 by name), the rest folded, with a search box. Tap a file to
 * pick it (rule: tap over type).
 */
import { useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { IconChevronRight, IconSearch } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { filesForEngine, shortFile, type Engine } from './videoStepLogic';
import { Warn, label as labelStyle, muted } from './bits';

export function FilePickerModal({ opened, onClose, title, files, engine, current, onPick, hint }: {
  opened: boolean; onClose: () => void; title: string; files: readonly string[]; engine: Engine; current?: readonly string[]; onPick: (file: string) => void; hint?: string;
}) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const { fit, rest } = useMemo(() => filesForEngine(files, engine), [files, engine]);
  const match = (f: string) => !q.trim() || f.toLowerCase().includes(q.trim().toLowerCase());
  const shownFit = fit.filter(match);
  const shownRest = rest.filter(match);
  const list = (items: string[]) => items.map((f) => {
    const on = current?.includes(f);
    return (
      <button key={f} type="button" onClick={() => { onPick(f); onClose(); }} aria-pressed={on} title={f}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 40, padding: '0 12px', border: on ? '1px solid var(--il-ember-line)' : '1px solid var(--il-line-soft)', borderRadius: 12, background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)', fontSize: 12, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortFile(f)}</span>
      </button>
    );
  });
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md" centered zIndex={T.z.modal} styles={{ body: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100dvh - 120px)' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 999, background: 'var(--il-card)' }}>
        <IconSearch size={14} color="var(--il-muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a file…" aria-label="Find a file" style={{ flex: 1, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 13, outline: 'none' }} />
      </div>
      {hint && <div style={muted}>{hint}</div>}
      <div className="il-scroll" style={{ minHeight: 0, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100dvh - 240px)', touchAction: 'pan-y' }}>
        {!files.length && <div style={{ ...muted, padding: 12, textAlign: 'center' }}>The video server lists nothing here yet.</div>}
        {list(shownFit)}
        {shownFit.length === 0 && files.length > 0 && !all && <div style={{ ...muted, padding: '6px 2px' }}>No {engine === 'h3' ? 'MiniMax H3' : 'Wan'} file matches.</div>}
        {shownRest.length > 0 && (
          all ? list(shownRest) : (
            <button type="button" onClick={() => setAll(true)} style={{ height: 34, border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Show {shownRest.length} other file{shownRest.length === 1 ? '' : 's'}
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

/** One row: label, the chosen file, a warning when the server lacks it; tap to change. */
export function FilePickRow({ label, value, files, engine, onPick, hint, warn }: {
  label: string; value: string; files: readonly string[]; engine: Engine; onPick: (file: string) => void; hint?: string; warn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const missing = warn ?? (!!value && files.length > 0 && !files.includes(value));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${label}: ${value || 'none'}`}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '6px 12px', border: 0, borderRadius: 12, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={labelStyle}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: value ? 'var(--il-fg)' : 'var(--il-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value ? shortFile(value) : 'Pick a file'}</span>
          {missing && <Warn>not on the server</Warn>}
        </span>
        <IconChevronRight size={16} stroke={2.4} color="var(--il-muted)" />
      </button>
      <FilePickerModal opened={open} onClose={() => setOpen(false)} title={label} files={files} engine={engine} current={value ? [value] : undefined} onPick={onPick} hint={hint} />
    </>
  );
}
