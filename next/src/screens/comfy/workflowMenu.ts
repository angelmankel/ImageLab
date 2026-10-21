/**
 * The saved-workflow menu in the ComfyUI screen (FIXLIST 34 + 45, FIXLIST-2 #53): right-click,
 * long-press or the row's "⋯": Open, Use as step · Rename, Duplicate, Save as · Delete.
 */
import { IconCopy, IconDeviceFloppy, IconPencil, IconPlayerPlay, IconPlus, IconTrash } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import type { ComfyWorkflowRow } from './useComfyWorkflows';

export interface ComfyWorkflowTarget {
  row: ComfyWorkflowRow;
  open: () => void;
  use: () => void;
  rename: (() => void) | null;
  duplicate: (() => void) | null;
  saveAs: (() => void) | null;
  remove: (() => void) | null;
}

registerMenu<ComfyWorkflowTarget>('comfy-workflow', [
  { id: 'open', label: 'Open in ComfyUI', icon: IconPlayerPlay, group: 'open', action: (t) => t.open() },
  { id: 'use', label: 'Use as step', icon: IconPlus, group: 'open', action: (t) => t.use() },
  { id: 'rename', label: 'Rename…', icon: IconPencil, group: 'file', visible: (t) => !!t.rename, action: (t) => t.rename?.() },
  { id: 'duplicate', label: 'Duplicate', icon: IconCopy, group: 'file', visible: (t) => !!t.duplicate, action: (t) => t.duplicate?.() },
  { id: 'saveas', label: 'Save as…', icon: IconDeviceFloppy, group: 'file', visible: (t) => !!t.saveAs, action: (t) => t.saveAs?.() },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', visible: (t) => !!t.remove, action: (t) => t.remove?.() },
]);
