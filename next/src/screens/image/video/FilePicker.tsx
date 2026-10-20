/**
 * A tiny "pick a server file" row for the Video step's SETTINGS slots that have no CivitAI
 * mapping or no model kind of their own (the RIFE / FILM interpolation model, the upscale model
 * in the Upscale fold): the chosen file, "not on the server" when the list lacks it, tap = the
 * model component's server-file grid (`ModelPickerModal`). Every model slot of the Model tab
 * goes through `ModelList` instead (rule 4).
 */
import { useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { ModelPickerModal } from '~/screens/image/model';
import { shortFile } from './videoStepLogic';
import { Warn, label as labelStyle } from './bits';

export function FilePickRow({ label, value, files, onPick, warn }: {
  label: string; value: string; files: readonly string[]; onPick: (file: string) => void; warn?: boolean;
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
      <ModelPickerModal opened={open} onClose={() => setOpen(false)} title={label} files={[...files]} selected={value ? [value] : undefined} onPick={(f) => { onPick(f); setOpen(false); }} />
    </>
  );
}
