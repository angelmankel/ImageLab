import { IconReload } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { ToolbarButton } from '@/features/generate/ToolbarButton';

/**
 * Recall the selected image's saved workflow + prompt layers back into the
 * editor (v1's toolbar recall button). Disabled when nothing is selected.
 */
export function RecallButton() {
  const selectedEntry = useStore(s => s.selectedEntry);
  const recallSelected = useStore(s => s.recallSelected);
  const disabled = !selectedEntry;

  return (
    <ToolbarButton
      icon={<IconReload size={16} />}
      label="Recall parameters"
      tooltip={disabled
        ? 'Select an image to recall its parameters'
        : 'Recall this image’s workflow + prompt into the editor'}
      onClick={() => recallSelected()}
      disabled={disabled}
    />
  );
}
