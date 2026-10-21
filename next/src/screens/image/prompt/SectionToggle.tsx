/**
 * Item 7 (Prompt tab use): the low-profile section header — a small chevron + label, no box. Click
 * the row (label or chevron) to open / close. `extra` sits after the label (the collapsed prompt's
 * one-line preview, a count badge…); `right` sits at the far end and does not toggle.
 * NOTE: stands in for base's shared `Collapse` header (`~/ui`) until that ships; same look.
 */
import type { CSSProperties, ReactNode } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { dur } from '~/theme/motion';

export function SectionToggle({ open, onToggle, label, extra, right, tone, style }: {
  open: boolean; onToggle: () => void; label: ReactNode; extra?: ReactNode; right?: ReactNode; tone?: string; style?: CSSProperties;
}) {
  const phone = useIsPhone();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: phone ? 40 : 26, ...style }}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{ flex: 1, minWidth: 0, minHeight: phone ? 40 : 26, display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', border: 0, background: 'transparent', cursor: 'pointer', color: tone ?? 'var(--il-muted)', font: 'inherit', textAlign: 'left' }}>
        <IconChevronDown size={14} stroke={2.6} aria-hidden
          style={{ flex: 'none', transform: open ? 'none' : 'rotate(-90deg)', transition: `transform ${dur(0.15)} ease` }} />
        <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase' }}>{label}</span>
        {extra}
      </button>
      {right}
    </div>
  );
}
