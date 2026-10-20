/**
 * Small shared pieces of the Video step's tabs (the look: tight cards, eyebrow titles, a
 * "More" fold, a pill button). Colours only from --il-*.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { IconChevronDown, IconChevronRight, IconAlertTriangle } from '@tabler/icons-react';

export const card: CSSProperties = { background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 };
export const label: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' };
export const muted: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.4 };
export const pillBtn: CSSProperties = { height: 30, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' };

/** A card with a title line (and an optional value on the right). */
export function Section({ title, value, children, style }: { title: string; value?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...card, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={label}>{title}</span>
        {value != null && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

/** A folded group ("More", "Upscale + Finish"): one tap row, the body under it. */
export function Fold({ title, summary, children, defaultOpen = false }: { title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 40, padding: '0 12px', border: 0, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-fg)', fontSize: 13, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
        {open ? <IconChevronDown size={14} stroke={2.4} color="var(--il-muted)" /> : <IconChevronRight size={14} stroke={2.4} color="var(--il-muted)" />}
        <span style={{ flex: 1 }}>{title}</span>
        {summary && !open && <span style={{ ...muted, maxWidth: '55%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>}
      </button>
      {open && children}
    </div>
  );
}

/** A warning line: the file is not on the server. */
export function Warn({ children }: { children: ReactNode }) {
  return <div style={{ ...muted, color: 'var(--il-warn)', display: 'flex', alignItems: 'center', gap: 5 }}><IconAlertTriangle size={12} />{children}</div>;
}

/** A row of chips with a label above. */
export function ChipGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {title && <span style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.4px', fontSize: 10 }}>{title}</span>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
