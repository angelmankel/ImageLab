import type { CSSProperties, ReactNode } from 'react';
import { Tooltip } from '@mantine/core';

/**
 * A square icon button for toolbars and rails. 36×36 (`size`), round-ish, transparent until hover;
 * `on` = ember tint; `tone='primary'` = solid ember. Always has a label (tooltip + aria).
 */
export function IconBtn({ icon, label, onClick, on, disabled, size = 36, tone = 'ghost', style, tooltip = true }: {
  icon: ReactNode; label: string; onClick?: () => void; on?: boolean; disabled?: boolean; size?: number;
  tone?: 'ghost' | 'card' | 'primary'; style?: CSSProperties; tooltip?: boolean;
}) {
  const btn = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32), border: 0, display: 'grid', placeItems: 'center', flex: 'none',
        background: tone === 'primary' ? 'var(--il-ember)' : on ? 'var(--il-ember-soft)' : tone === 'card' ? 'var(--il-card)' : 'transparent',
        color: tone === 'primary' ? 'var(--il-bg)' : on ? 'var(--il-ember-hi)' : 'var(--il-fg2)',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer', ...style,
      }}
    >
      {icon}
    </button>
  );
  return tooltip ? <Tooltip label={label}>{btn}</Tooltip> : btn;
}

/** A 1px vertical hairline between toolbar groups. */
export function Sep() {
  return <span aria-hidden style={{ width: 1, height: 20, background: 'var(--il-line-strong)', margin: '0 4px', flex: 'none' }} />;
}
