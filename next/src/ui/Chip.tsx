import type { CSSProperties, ReactNode } from 'react';

/**
 * A tap chip (snippets, trigger words, size presets, filter values). Pill shape, card grey,
 * ember when `on`, dashed when `dashed` (the "+ Add" chip). Height 30 by default, 26 when `small`.
 */
export function Chip({ children, on, dashed, small, icon, onClick, title, style, disabled }: {
  children: ReactNode; on?: boolean; dashed?: boolean; small?: boolean; icon?: ReactNode;
  onClick?: () => void; title?: string; style?: CSSProperties; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={on}
      style={{
        height: small ? 26 : 30,
        padding: small ? '0 9px' : '0 11px',
        borderRadius: 999,
        border: dashed ? '1px dashed var(--il-ok)' : on ? '1px solid var(--il-ember-line)' : '1px solid var(--il-line-soft)',
        background: on ? 'var(--il-ember-soft)' : dashed ? 'transparent' : 'var(--il-card)',
        color: on ? 'var(--il-ember-hi)' : dashed ? 'var(--il-ok)' : 'var(--il-fg2)',
        fontWeight: 700,
        fontSize: small ? 11 : 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
