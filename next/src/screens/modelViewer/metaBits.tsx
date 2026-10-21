/**
 * The metadata column's small shapes: a titled `Section` (the `Label` eyebrow + an optional
 * action at the right), `Line` (a plain label / value row, copy on hover) and `Fold` (item 29's low-profile collapse), `CopyBtn` (every hash, id and seed
 * has one), `Mono` for hashes, and `FoldText` (a long text folded to N lines with more/less).
 * Dense by design: 12px body, 11px labels, 6–8px gaps, no box around a single line.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { IconCopy } from '@tabler/icons-react';
import { Collapse } from '~/ui';
import './viewer.css';
import { Label } from '~/screens/models/bits';
import { useModelActions } from '~/screens/models/useModelActions';

export function Section({ title, right, children, card, style }: { title: string; right?: ReactNode; children: ReactNode; card?: boolean; style?: CSSProperties }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(card ? { background: 'var(--il-card)', borderRadius: 14, padding: 10 } : {}), ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
        <Label>{title.toUpperCase()}</Label>
        {right}
      </div>
      {children}
    </section>
  );
}

/** An ember text button ("Copy all", "more"). */
export function TextBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return <button type="button" onClick={onClick} title={title} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>{children}</button>;
}

export function CopyBtn({ text, what, size = 12, hover }: { text: string; what?: string; size?: number; hover?: boolean }) {
  const { copy } = useModelActions();
  return (
    <button type="button" className={hover ? 'ilv-copy' : undefined} aria-label={`Copy ${what ?? text}`} title="Copy" onClick={(e) => { e.stopPropagation(); void copy(text, what ? `${what} copied` : 'Copied'); }}
      style={{ width: size + 10, height: size + 10, border: 0, borderRadius: 6, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', flex: 'none', cursor: 'pointer', padding: 0 }}>
      <IconCopy size={size} stroke={2.2} />
    </button>
  );
}

export function Mono({ children, style, title }: { children: ReactNode; style?: CSSProperties; title?: string }) {
  return <span title={title} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, letterSpacing: 0, ...style }}>{children}</span>;
}

/** A line of text folded to `lines` with a more/less toggle under it. */
export function FoldText({ text, lines = 6, muted = true, size = 12 }: { text: string; lines?: number; muted?: boolean; size?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.split('\n').length > lines || text.length > lines * 90;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
      <p style={{ margin: 0, fontSize: size, lineHeight: 1.5, color: muted ? 'var(--il-fg2)' : 'var(--il-fg)', display: '-webkit-box', WebkitLineClamp: open ? undefined : lines, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{text}</p>
      {long && <TextBtn onClick={() => setOpen((o) => !o)}>{open ? 'less' : 'more'}</TextBtn>}
    </div>
  );
}

/** A scrollable, selectable text box (the prompt, the negative) with a copy button in its corner row. */
export function TextBox({ label, text, tone = 'fg' }: { label: string; text: string; tone?: 'fg' | 'muted' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>{label}</span>
        <CopyBtn text={text} what={label} size={11} />
      </div>
      <div className="il-scroll" style={{ maxHeight: 112, overflowY: 'auto', background: 'var(--il-panel)', borderRadius: 10, padding: '6px 8px', fontSize: 12, lineHeight: 1.45, color: tone === 'muted' ? 'var(--il-fg2)' : 'var(--il-fg)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text', touchAction: 'pan-y' }}>
        {text}
      </div>
    </div>
  );
}

/**
 * One plain row (item 29): muted label at the left, the value at the right, the copy icon only on
 * hover. No box: rows sit on the panel, separated by their own spacing.
 */
export function Line({ label, value, copy, mono, title }: { label: string; value: ReactNode; copy?: string; mono?: boolean; title?: string }) {
  return (
    <div className="ilv-row" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26, minWidth: 0 }}>
      <span style={{ flex: 'none', maxWidth: '45%', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span title={title ?? (typeof value === 'string' ? value : undefined)} style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {mono ? <Mono>{value}</Mono> : value}
      </span>
      {copy ? <CopyBtn text={copy} what={label} size={11} hover /> : null}
    </div>
  );
}

/**
 * A quiet fold (item 29): base's low-profile `Collapse` (item 7) — chevron + label, a one-line
 * summary while folded — on a hairline. Closed by default; remembered per viewer under `id`.
 */
export function Fold({ title, summary, id, children }: { title: string; summary?: string; id?: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--il-line)', padding: '4px 0' }}>
      <Collapse id={`mv.${id ?? title}`} defaultOpen={false} label={title} preview={summary} headerStyle={{ minHeight: 36 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px 8px' }}>{children}</div>
      </Collapse>
    </div>
  );
}
