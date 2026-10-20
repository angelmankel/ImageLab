import { forwardRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { btnRadius } from '~/theme/tokens';
import { definedOnly, flashAt } from './Button';
import { Tip } from './Tip';

/**
 * A square icon button for toolbars and rails. 36×36 (`size`), rounded by the one button token,
 * transparent until hover; `on` = ember tint; `tone='primary'` = solid ember. Always has a label
 * (tooltip + aria); `hint` adds a parameter's hint text (item 26); `keys` shows its hotkey.
 * Carries `.il-btn` for the hover / press feedback (item 44). Forwards its ref.
 */
export const IconBtn = forwardRef<HTMLButtonElement, {
  icon: ReactNode; label: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; on?: boolean; disabled?: boolean; size?: number;
  tone?: 'ghost' | 'card' | 'primary' | 'elev'; style?: CSSProperties; tooltip?: boolean; hint?: string; keys?: string;
  className?: string; tipPos?: 'top' | 'bottom' | 'left' | 'right';
  'aria-expanded'?: boolean; 'aria-haspopup'?: boolean | 'menu' | 'dialog' | 'listbox';
}>(function IconBtn({ icon, label, onClick, on, disabled, size = 36, tone = 'ghost', style, tooltip = true, hint, keys, className, tipPos, ...aria }, ref) {
  const btn = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      onMouseDown={flashAt}
      className={['il-btn', 'il-btn-flash', tone === 'primary' && 'il-btn-primary', tone === 'ghost' && !on && 'il-btn-ghost', className].filter(Boolean).join(' ')}
      style={{
        width: size, height: size, borderRadius: btnRadius(size), border: 0, display: 'grid', placeItems: 'center', flex: 'none', padding: 0,
        background: tone === 'primary' ? 'var(--il-ember)' : on ? 'var(--il-ember-soft)' : tone === 'card' ? 'var(--il-card-on)' : tone === 'elev' ? 'var(--il-elev)' : 'transparent',
        color: tone === 'primary' ? 'var(--il-bg)' : on ? 'var(--il-ember-hi)' : tone === 'card' ? 'var(--il-fg)' : 'var(--il-fg2)',
        boxShadow: on && tone !== 'primary' ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined,
        opacity: disabled ? 0.4 : 1, ...definedOnly(style),
      }}
      {...aria}
    >
      {icon}
    </button>
  );
  return tooltip ? <Tip label={label} hint={hint} keys={keys} position={tipPos}>{btn}</Tip> : btn;
});

/** A 1px vertical hairline between toolbar groups. */
export function Sep() {
  return <span aria-hidden style={{ width: 1, height: 20, background: 'var(--il-line-strong)', margin: '0 4px', flex: 'none' }} />;
}
