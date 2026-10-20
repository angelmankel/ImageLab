import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { btnRadius } from '~/theme/tokens';
import { definedOnly, flashAt } from './Button';
import { Tip } from './Tip';

/**
 * A tap chip (snippets, trigger words, size presets, filter values). Rounded by the one button
 * token (item 33), card grey, ember when `on`, dashed when `dashed` (the "+ Add" chip). Height 30
 * by default, 26 when `small`, 36 when `tall` (phone rows). Carries the `.il-btn` feedback.
 * `hint` = a parameter id for the tooltip (item 26).
 */
export const Chip = forwardRef<HTMLButtonElement, {
  children: ReactNode; on?: boolean; dashed?: boolean; small?: boolean; tall?: boolean; icon?: ReactNode;
  onClick?: () => void; title?: string; style?: CSSProperties; disabled?: boolean; hint?: string;
  'aria-label'?: string;
}>(function Chip({ children, on, dashed, small, tall, icon, onClick, title, style, disabled, hint, ...aria }, ref) {
  const h = tall ? 36 : small ? 26 : 30;
  const pad = tall ? 13 : small ? 9 : 11;
  const btn = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={hint ? undefined : title}
      disabled={disabled}
      aria-pressed={on}
      className="il-btn il-btn-flash"
      onMouseDown={flashAt}
      style={{
        height: h,
        padding: `0 ${pad}px 0 ${icon ? pad - 2 : pad}px`,
        borderRadius: btnRadius(h),
        border: dashed ? '1px dashed var(--il-ok)' : on ? '1px solid var(--il-ember-line)' : '1px solid var(--il-line-soft)',
        background: on ? 'var(--il-ember-soft)' : dashed ? 'transparent' : 'var(--il-card)',
        color: on ? 'var(--il-ember-hi)' : dashed ? 'var(--il-ok)' : 'var(--il-fg2)',
        fontWeight: 700,
        fontSize: tall ? 12 : small ? 11 : 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...definedOnly(style),
      }}
      {...aria}
    >
      {icon}
      {children}
    </button>
  );
  return hint ? <Tip hint={hint} label={title}>{btn}</Tip> : btn;
});
