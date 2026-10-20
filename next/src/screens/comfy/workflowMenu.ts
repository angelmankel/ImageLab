/**
 * Right-click / long-press on a saved workflow in the ComfyUI screen (FIXLIST 34 + 45):
 * open it in ComfyUI, use it as a step, delete it (Undo in the note).
 */
import { IconPlayerPlay, IconPlus, IconTrash } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import type { ComfyWorkflowRow } from './useComfyWorkflows';

export interface ComfyWorkflowTarget {
  row: ComfyWorkflowRow;
  open: () => void;
  use: () => void;
  remove: (() => void) | null;
}

registerMenu<ComfyWorkflowTarget>('comfy-workflow', [
  { id: 'open', label: 'Open in ComfyUI', icon: IconPlayerPlay, group: 'open', action: (t) => t.open() },
  { id: 'use', label: 'Use as step', icon: IconPlus, group: 'open', action: (t) => t.use() },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', visible: (t) => !!t.remove, action: (t) => t.remove?.() },
]);
