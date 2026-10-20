import { Switch as MSwitch } from '@mantine/core';

/** On/Off switch, label on the left, ember when on. */
export function Switch({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (on: boolean) => void; description?: string }) {
  return (
    <MSwitch
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      label={label}
      description={description}
      labelPosition="left"
      color="ember"
      size="sm"
      styles={{ body: { justifyContent: 'space-between', alignItems: 'center' }, label: { fontWeight: 700, fontSize: 12, color: 'var(--il-fg2)', paddingInlineEnd: 0 } }}
    />
  );
}
