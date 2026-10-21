/**
 * The Paste button and its note (fix list 2 item 36). Every picture slot shows `PasteButton`
 * (`ImageDropZone` always does); a slot that is not an ImageDropZone pairs it with `usePaste`.
 * `PasteNote` is the inline "nothing to paste" line (no toast, item 12).
 */
import { IconClipboard, IconInfoCircle } from '@tabler/icons-react';
import { Button, Tip, type ButtonSize } from '~/ui';

export function PasteButton({ onPaste, size = 'sm', h, disabled, iconOnly, grow, style }: {
  onPaste: () => void; size?: ButtonSize; h?: number; disabled?: boolean; iconOnly?: boolean; grow?: boolean; style?: React.CSSProperties;
}) {
  return (
    <Tip label="Paste a picture" keys="Ctrl+V" position={iconOnly ? 'left' : undefined}>
      <Button size={size} h={h} icon={<IconClipboard size={14} />} onClick={onPaste} disabled={disabled} grow={grow} style={style} aria-label="Paste a picture" data-paste-button="">
        {iconOnly ? undefined : 'Paste'}
      </Button>
    </Tip>
  );
}

export function PasteNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--il-warn)', lineHeight: 1.35 }}>
      <IconInfoCircle size={14} style={{ flex: 'none' }} />{note}
    </div>
  );
}
