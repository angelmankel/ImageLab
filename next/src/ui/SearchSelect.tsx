/**
 * THE searchable select / autocomplete (item 38), replacing Mantine's plain Select where a list
 * is long (sampler, scheduler, VAE, models). Built on Mantine's Combobox:
 *   - the closed box shows the value; open, the box is an empty search with the value as its
 *     placeholder (no blue text selection, no spell-check squiggle, no password-manager icons);
 *   - type → options ranked (prefix, word start, contains, letters in order) with the typed part
 *     highlighted in ember; ↑ ↓ move a clear hover row, Enter picks, Esc closes;
 *   - the current value reads ember with a check; optional groups (`group`) and a short
 *     `description` under an option; a soft 120ms pop when it opens;
 *   - the same field sizes as every other box: sm 30 · md 34 · lg 44 (the phone), and `bare`
 *     for a value that sits inside a card row (transparent, right-aligned, as in Sampling).
 * Options are `{ value, label?, description?, group? }` or plain strings. A value the list lacks
 * is kept as its own first option ("(not on this server)").
 */
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Combobox, useCombobox } from '@mantine/core';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { filterOptions, groupOptions, splitMatch, type SelectOption } from './selectLogic';
import { ResetButton, resetWithUndo } from './ResetButton';

export type { SelectOption } from './selectLogic';

export interface SearchSelectProps {
  value: string | null;
  onChange: (v: string) => void;
  options: ReadonlyArray<string | SelectOption>;
  /** aria-label (and what "No match" talks about). */
  label: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Inside a card row: no box of its own, text right-aligned. */
  bare?: boolean;
  /** Typing filters (default on). Off = a plain pick list that still opens the same way. */
  searchable?: boolean;
  /** An × that empties the value (calls `onClear`). */
  onClear?: () => void;
  disabled?: boolean;
  /** Width of the open list (default: the box's, at least 220). */
  dropdownWidth?: number;
  /** Where the list opens. */
  position?: 'bottom-start' | 'bottom-end' | 'bottom';
  /** How a missing value is marked. */
  missingLabel?: (v: string) => string;
  nothingFound?: string;
  /** Extra node at the left of the box (an icon). */
  leftSection?: ReactNode;
  style?: CSSProperties;
  maxDropdownHeight?: number;
  /** The default (item 8): a ↺ in the box puts it back while the value differs (Ctrl+Z undoes). */
  defaultValue?: string | null;
}

const HEIGHT = { sm: 30, md: 34, lg: 44 } as const;

function Highlight({ text, q }: { text: string; q: string }) {
  return <>{splitMatch(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

export function SearchSelect({
  value, onChange, options, label, placeholder, size, bare, searchable = true, onClear, disabled, dropdownWidth, position = 'bottom-start',
  missingLabel = (v) => `${v} (not on this server)`, nothingFound = 'No match', leftSection, style, maxDropdownHeight = 300, defaultValue,
}: SearchSelectProps) {
  const phone = useIsPhone();
  const sz = size ?? (phone ? 'lg' : 'md');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const combobox = useCombobox({
    onDropdownClose: () => { combobox.resetSelectedOption(); setSearch(''); },
    onDropdownOpen: () => { combobox.updateSelectedOptionIndex('active'); },
  });

  const all = useMemo<SelectOption[]>(() => {
    const list = options.map((o) => (typeof o === 'string' ? { value: o } : o));
    if (value && !list.some((o) => o.value === value)) list.unshift({ value, label: missingLabel(value) });
    return list;
  }, [options, value, missingLabel]);
  const current = all.find((o) => o.value === value);
  const shown = filterOptions(all, searchable ? search : '');
  const groups = groupOptions(shown);
  const open = combobox.dropdownOpened;

  const pick = (v: string) => {
    combobox.closeDropdown();
    inputRef.current?.blur();
    if (v !== value) onChange(v);
  };

  const opt = (o: SelectOption) => {
    const on = o.value === value;
    return (
      <Combobox.Option key={o.value} value={o.value} active={on} aria-selected={on} className="il-opt">
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span className="il-opt-label"><Highlight text={o.label ?? o.value} q={searchable ? search : ''} /></span>
          {o.description && <span className="il-opt-desc">{o.description}</span>}
        </span>
        {on && <IconCheck size={14} stroke={2.6} style={{ flex: 'none', color: 'var(--il-ember)' }} />}
      </Combobox.Option>
    );
  };

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={pick}
      withinPortal
      zIndex={T.z.popover}
      position={position}
      width={dropdownWidth ?? 'target'}
      offset={4}
      transitionProps={{ transition: 'pop', duration: 120 }}
      classNames={{ dropdown: 'il-dd', options: 'il-scroll', group: 'il-ogroup', groupLabel: 'il-glabel', empty: 'il-empty', footer: 'il-ofoot' }}
      disabled={disabled}
    >
      <Combobox.DropdownTarget>
        <div
          className={bare ? 'il-field il-field-bare' : 'il-field'}
          data-tall={sz === 'lg'}
          data-open={open}
          data-disabled={disabled}
          data-align={bare ? 'right' : undefined}
          style={{ height: HEIGHT[sz], cursor: disabled ? 'default' : 'pointer', ...style }}
          onMouseDown={(e) => {
            if (disabled || e.target === inputRef.current) return;
            e.preventDefault();
            if (open) combobox.closeDropdown();
            else { inputRef.current?.focus(); combobox.openDropdown(); }
          }}
        >
          {leftSection}
          <Combobox.EventsTarget>
            <input
              ref={inputRef}
              aria-label={label}
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              readOnly={!searchable}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              data-1p-ignore
              data-lpignore="true"
              enterKeyHint="go"
              value={open && searchable ? search : (current?.label ?? current?.value ?? '')}
              placeholder={open ? (current?.label ?? current?.value ?? placeholder) : placeholder}
              onChange={(e) => { setSearch(e.currentTarget.value); combobox.openDropdown(); combobox.updateSelectedOptionIndex(); }}
              onClick={() => combobox.openDropdown()}
              onKeyDown={(e) => {
                // Opens on click, typing, ↓ / ↑ (Mantine) or Enter / Space — never on focus alone.
                if (open || disabled) return;
                if (e.key === 'Enter' || (!searchable && e.key === ' ')) { e.preventDefault(); combobox.openDropdown(); combobox.updateSelectedOptionIndex('active'); }
              }}
              onBlur={() => combobox.closeDropdown()}
              style={{ cursor: searchable ? 'text' : 'pointer', textOverflow: 'ellipsis' }}
            />
          </Combobox.EventsTarget>
          {defaultValue != null && !disabled && (
            <ResetButton shown={!open && value !== defaultValue}
              label={`Reset to ${all.find((o) => o.value === defaultValue)?.label ?? defaultValue}`}
              onReset={() => resetWithUndo(label, value, defaultValue, (v) => { if (v != null) onChange(v); })} size={sz === 'lg' ? 30 : 20} inField />
          )}
          {onClear && value && !open ? (
            <button type="button" className="il-x" aria-label={`Clear ${label}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}>
              <IconX size={13} stroke={2.4} />
            </button>
          ) : (
            <IconChevronDown size={14} stroke={2.6} className="il-chev" style={{ flex: 'none' }} aria-hidden />
          )}
        </div>
      </Combobox.DropdownTarget>
      <Combobox.Dropdown>
        <Combobox.Options style={{ maxHeight: maxDropdownHeight, overflowY: 'auto', touchAction: 'pan-y' }}>
          {groups.map((g) => (g.group
            ? <Combobox.Group key={g.group} label={g.group}>{g.items.map(opt)}</Combobox.Group>
            : g.items.map(opt)))}
          {shown.length === 0 && <Combobox.Empty>{nothingFound}</Combobox.Empty>}
        </Combobox.Options>
        {!phone && searchable && (
          <Combobox.Footer>
            <kbd className="il-tip-key">↑</kbd><kbd className="il-tip-key">↓</kbd> move · <kbd className="il-tip-key">Enter</kbd> pick · <kbd className="il-tip-key">Esc</kbd> close
          </Combobox.Footer>
        )}
      </Combobox.Dropdown>
    </Combobox>
  );
}
