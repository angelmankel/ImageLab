/** SelectField (v1): a labelled, searchable Mantine select (a plain list on touch screens — see `useTouchInput`). */
import type { ReactNode } from 'react';
import { Select, type ComboboxData } from '@mantine/core';
import { FieldWrapper } from './FieldWrapper';
import { useTouchInput } from '@/hooks/useTouchInput';

export interface SelectFieldProps {
  label?: string;
  description?: ReactNode;
  value: string | null;
  onChange: (v: string) => void;
  data: ComboboxData;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  rightSection?: ReactNode;
}

export function SelectField({ label, description, value, onChange, data, placeholder = 'Select...', searchable = true, clearable, disabled, rightSection }: SelectFieldProps) {
  const touch = useTouchInput();
  return (
    <FieldWrapper label={label} description={description} rightSection={rightSection}>
      <Select
        placeholder={placeholder}
        data={data}
        searchable={searchable && !touch}
        clearable={clearable}
        value={value}
        onChange={(v) => { if (v != null) onChange(v); else if (clearable) onChange(''); }}
        allowDeselect={false}
        disabled={disabled}
        aria-label={label}
        comboboxProps={{ withinPortal: true }}
        maxDropdownHeight={300}
      />
    </FieldWrapper>
  );
}
