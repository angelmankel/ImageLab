/**
 * Undo / Redo next to the logo, before the session tabs (fix list 2, item 12). Disabled when the
 * current session has nothing to undo / redo; the tooltip names the action ("Undo delete image").
 */
import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react';
import { IconBtn } from '~/ui';
import { redo, undo, useRedoLabel, useUndoLabel } from '~/app/undo';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function UndoButtons({ size = 36 }: { size?: number }) {
  const u = useUndoLabel();
  const r = useRedoLabel();
  return (
    <>
      <IconBtn icon={<IconArrowBackUp size={19} stroke={2.2} />} label={u ? `Undo ${lower(u)}` : 'Undo'} keys="Ctrl+Z" size={size} disabled={!u} onClick={() => undo()} />
      <IconBtn icon={<IconArrowForwardUp size={19} stroke={2.2} />} label={r ? `Redo ${lower(r)}` : 'Redo'} keys="Ctrl+Shift+Z" size={size} disabled={!r} onClick={() => redo()} />
    </>
  );
}
