/**
 * A searchable pick from ONE provider's model list (chat models, or its vision models with a
 * "Same as model" first entry). The saved id stays listed while the list lacks it.
 */
import { Select } from '@mantine/core';
import { aiModelLabel, shortModelName, type AiModel } from '@/lib/aiProviders';
import { ctlStyle, inputStyles } from '../inputs';

const SAME = '__same__';

export function ModelSelect({ models, value, onChange, disabled, placeholder, sameAs, label }: {
  models: readonly AiModel[]; value: string; onChange: (id: string) => void; disabled?: boolean; placeholder?: string;
  /** Offer "Same as model" (value '') first. */
  sameAs?: boolean; label: string;
}) {
  const items = models.map((m) => ({ value: m.id, label: aiModelLabel(m) }));
  if (value && !models.some((m) => m.id === value)) items.unshift({ value, label: `${shortModelName(value)} (not in the list)` });
  const data = sameAs ? [{ value: SAME, label: 'Same as model' }, ...items] : items;
  return (
    <Select
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      aria-label={label}
      size="sm"
      styles={inputStyles}
      style={ctlStyle}
      value={sameAs ? (value || SAME) : (value || null)}
      placeholder={placeholder}
      disabled={disabled}
      allowDeselect={false}
      searchable
      nothingFoundMessage="No model matches"
      maxDropdownHeight={320}
      comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 320 }}
      data={data}
      onChange={(v) => { if (v !== null) onChange(v === SAME ? '' : v); }}
    />
  );
}
