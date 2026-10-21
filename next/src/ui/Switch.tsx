import { Switch as MSwitch } from '@mantine/core';
import { Tip } from './Tip';

/**
 * On/Off switch, label on the left 8px from the track (item 48), ember when on, a springy thumb
 * inset 3px on every side (`.il-switch`). `hint` = a
 * parameter id for the tooltip (item 26); `big` = the phone's 48×28 track.
 */
export function Switch({ label, checked, onChange, description, hint, big, disabled }: {
  label: string; checked: boolean; onChange: (on: boolean) => void; description?: string; hint?: string; big?: boolean; disabled?: boolean;
}) {
  const sw = (
    <MSwitch
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      label={label}
      description={description}
      labelPosition="left"
      color="ember"
      size={big ? 'md' : 'sm'}
      disabled={disabled}
      className="il-switch"
      styles={{ body: { justifyContent: 'space-between', alignItems: 'center', gap: 0 }, labelWrapper: { justifyContent: 'center' }, label: { fontWeight: 700, fontSize: big ? 13 : 12, color: 'var(--il-fg2)', paddingInlineEnd: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: '100%' }, track: { cursor: 'pointer' } }}
    />
  );
  return hint ? <Tip hint={hint}><div style={{ display: 'flex', flexDirection: 'column' }}>{sw}</div></Tip> : sw;
}
