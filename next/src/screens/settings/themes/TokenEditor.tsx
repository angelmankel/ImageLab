/**
 * Settings → Themes → Fine-tune (item 35): every colour token, one swatch + its hex each, under
 * Surfaces / Lines / Text / Accent / Status. Folded until opened (here or by tapping the
 * generator's strip). Any edit makes the palette "Yours (unsaved)".
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { IconChevronDown } from '@tabler/icons-react';
import { useTheme } from '~/theme/themeStore';
import { isHex, PALETTE_LABELS, type PaletteKey } from '~/theme/themeModel';
import { ColorWell } from './bits';

export const useFineTune = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const GROUPS: ReadonlyArray<{ title: string; keys: PaletteKey[] }> = [
  { title: 'Surfaces', keys: ['bgDeep', 'bg', 'panel', 'elev', 'card', 'cardOn'] },
  { title: 'Lines', keys: ['line', 'lineSoft', 'lineStrong'] },
  { title: 'Text', keys: ['fg', 'fg2', 'muted', 'dim'] },
  { title: 'Accent', keys: ['ember', 'emberHi', 'emberSoft', 'emberLine', 'accent2'] },
  { title: 'Status', keys: ['ok', 'okSoft', 'okLine', 'warn', 'err', 'info'] },
];

function HexBox({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="il-field" style={{ height: 30, width: 92, flex: 'none', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }}>
      <input value={text} aria-label={`${label} hex`} maxLength={7} spellCheck={false}
        onChange={(e) => { const v = e.currentTarget.value; setText(v); if (isHex(v) && v.replace('#', '').length === 6) onChange(v.startsWith('#') ? v : `#${v}`); }}
        onBlur={() => setText(value)} />
    </div>
  );
}

export function TokenEditor() {
  const open = useFineTune((s) => s.open);
  const setOpen = useFineTune((s) => s.setOpen);
  const palette = useTheme((s) => s.theme.palette);
  const setToken = useTheme((s) => s.setToken);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) root.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [open]);
  return (
    <div ref={root} style={{ width: '100%' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="il-btn"
        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px', border: 0, borderRadius: 'calc(10px * var(--il-corners, 1))', background: 'var(--il-elev)', color: 'var(--il-fg2)', fontSize: 12, fontWeight: 700 }}>
        <IconChevronDown size={14} stroke={2.4} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform calc(.15s * var(--il-motion, 1) * var(--il-dur, 1))' }} />
        {open ? 'Hide the colours' : 'Show all 24 colours'}
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px 18px', marginTop: 10 }}>
          {GROUPS.map((g) => (
            <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="il-eyebrow">{g.title}</span>
              {g.keys.map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
                  <ColorWell value={palette[k]} onChange={(hex) => setToken(k, hex)} label={PALETTE_LABELS[k]} size={32} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>{PALETTE_LABELS[k]}</span>
                  <HexBox value={palette[k]} onChange={(hex) => setToken(k, hex)} label={PALETTE_LABELS[k]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
