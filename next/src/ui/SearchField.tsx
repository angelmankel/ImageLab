/**
 * THE search box (item 38): the pill every list's search uses (settings, library, …). A
 * magnifier, the text (no spell-check, no autofill, the phone's "search" key), a round × that
 * clears (a 28px target, 36 on touch), Esc clears and leaves the box, and an ember ring while
 * typing. Rounded by the one button token. Forwards its ref to the <input> (for "/" to focus).
 */
import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { btnRadius } from '~/theme/tokens';

export interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** aria-label (defaults to the placeholder). */
  label?: string;
  /** Height (36 default; the phone rows pass 44). */
  h?: number;
  autoFocus?: boolean;
  onEnter?: () => void;
  /** Extra node at the right end (a filter button). */
  right?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder = 'Search', label, h = 36, autoFocus, onEnter, right, className, style }, ref,
) {
  return (
    <label className={['il-search', className].filter(Boolean).join(' ')} style={{ height: h, borderRadius: btnRadius(h), ...style }}>
      <IconSearch size={15} stroke={2.4} style={{ flex: 'none' }} />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); onChange(''); e.currentTarget.blur(); }
          else if (e.key === 'Enter') onEnter?.();
        }}
      />
      {value && (
        <button type="button" className="il-x" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')}>
          <IconX size={14} stroke={2.4} />
        </button>
      )}
      {right}
    </label>
  );
});
