/**
 * Hints on / off (item 26): one small icon button for the footer (the shell agent places it),
 * lit when hints are on. Same store as the H key (`UiEffects`) and Settings → Hints. `withLabel` adds the word "Hints" for a roomier footer.
 */
import { IconBulb, IconBulbOff } from '@tabler/icons-react';
import { useHints } from './hints';
import { IconBtn } from './IconBtn';
import { Button } from './Button';
import { playSound } from '@/lib/sounds';

export function HintsToggle({ size = 30, withLabel }: { size?: number; withLabel?: boolean }) {
  const on = useHints((s) => s.enabled);
  const toggle = () => { useHints.getState().toggle(); playSound('toggle', { on: !on }); };
  const icon = on ? <IconBulb size={Math.round(size * 0.55)} /> : <IconBulbOff size={Math.round(size * 0.55)} />;
  const label = on ? 'Hints on — turn off' : 'Hints off — turn on';
  if (withLabel) {
    return <Button h={size} tone="ghost" on={on} icon={icon} onClick={toggle} tooltip={label} aria-label={label}>Hints</Button>;
  }
  return <IconBtn icon={icon} label={label} keys="H" size={size} on={on} onClick={toggle} />;
}
