import { Select as MSelect, Tooltip } from '@mantine/core';
import { cn } from '@/lib/cn';

/** An option may be a bare string (value === label) or an explicit value/label pair. */
type Option = string | { value: string; label: string };

type OptionState = {
  /** Render the option dimmed + unselectable. */
  disabled?: boolean;
  /** Hover hint — e.g. which servers have a model. */
  title?: string;
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  options: readonly Option[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  searchable?: boolean;
  size?: 'xs' | 'sm' | 'md';
  /** Per-option disabled/title state — used for resource availability. */
  getOptionState?: (value: string) => OptionState | undefined;
};

/**
 * The v1 select: Mantine's, so the dropdown is portalled, flips and shifts to stay on screen, and
 * sits above every panel and rail. Same props as before, so no caller changes.
 */
export function Select({
  value, onValueChange, options, placeholder, className, triggerClassName, ariaLabel, searchable, size = 'sm', getOptionState,
}: Props) {
  const data = options
    .map(o => (typeof o === 'string' ? { value: o, label: o } : o))
    .filter(o => o.value !== '')
    .map(o => ({ ...o, disabled: getOptionState?.(o.value)?.disabled }));
  return (
    <MSelect
      value={value || null}
      onChange={v => { if (v != null) onValueChange(v); }}
      data={data}
      placeholder={placeholder ?? 'Select...'}
      aria-label={ariaLabel}
      searchable={searchable ?? data.length > 12}
      allowDeselect={false}
      size={size}
      comboboxProps={{ withinPortal: true, shadow: 'md' }}
      maxDropdownHeight={300}
      className={cn('min-w-0 flex-1', className)}
      classNames={triggerClassName ? { input: triggerClassName } : undefined}
      renderOption={({ option }) => {
        const title = getOptionState?.(option.value)?.title;
        return title
          ? <Tooltip label={title} position="right" openDelay={300}><span className="block w-full">{option.label}</span></Tooltip>
          : option.label;
      }}
    />
  );
}
