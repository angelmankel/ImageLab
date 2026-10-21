/**
 * Item 42: the right-click / long-press / ⋯ menus of the snippet system.
 *   'style-tile'        a tile, pill or Manage row: Edit · Duplicate · Move to › · Copy text · Delete
 *   'snippet-category'  a category (grid title, Manage list): Add snippet here · ✦ Generate snippets ·
 *                       Manage… · Move up / down (the touch way to reorder) · Delete category (its snippets go to Uncategorized)
 * Deletes are app undo steps (Ctrl+Z), never toasts.
 */
import { IconArrowDown, IconArrowUp, IconCopy, IconFolderSymlink, IconPencil, IconPlus, IconSettings, IconSparkles, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Snippet, SnippetCategory } from '@/lib/types';
import { registerMenu } from '~/app/contextMenu';
import { isModelSpecific } from '../prompt/promptSearch';
import { useTileEdit } from '../prompt/tileStore';
import { generateSnippetsFor } from './generateBridge';
import { UNCATEGORIZED } from './snippetModel';
import { deleteCategory, deleteSnippets, duplicateSnippets, moveSnippets, reorderCategory } from './snippetOps';

const catsNow = () => useStore.getState().snippetCategories.filter((c) => !isModelSpecific({ id: '', categoryId: c.id }));
const label = (c: SnippetCategory) => `${c.icon ? `${c.icon} ` : ''}${c.name.replace(/^negative\s*[·:\-–—]\s*/i, '')}`;

registerMenu<Snippet>('style-tile', [
  { id: 'edit', label: 'Edit', icon: IconPencil, action: (s) => useTileEdit.getState().edit(s.id) },
  { id: 'duplicate', label: 'Duplicate', icon: IconCopy, action: (s) => { duplicateSnippets([s.id]); } },
  {
    id: 'move', label: 'Move to', icon: IconFolderSymlink,
    submenu: (s) => catsNow().map((c) => ({ id: `to-${c.id}`, label: label(c), checked: () => s.categoryId === c.id, action: () => moveSnippets([s.id], c.id) })),
  },
  { id: 'copy', label: 'Copy text', icon: IconCopy, action: (s) => { void navigator.clipboard?.writeText(s.layers ? s.layers.map((l) => l.text).join(', ') : s.text); } },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', action: (s) => deleteSnippets([s.id]) },
]);

/**
 * The category one place up / down among the visible ones (mobile pass: the touch way to reorder —
 * dragging ⋮⋮ is mouse-only). null when it cannot move that way (the end, or Uncategorized).
 */
function neighbour(c: SnippetCategory, dir: -1 | 1): { from: number; to: number } | null {
  if (c.id === UNCATEGORIZED) return null;
  const vis = catsNow();
  const target = vis[vis.findIndex((x) => x.id === c.id) + dir];
  if (!target || target.id === UNCATEGORIZED) return null;
  const all = useStore.getState().snippetCategories;
  const from = all.findIndex((x) => x.id === c.id);
  const to = all.findIndex((x) => x.id === target.id);
  return from >= 0 && to >= 0 ? { from, to } : null;
}

registerMenu<SnippetCategory>('snippet-category', [
  { id: 'add', label: 'Add a snippet here', icon: IconPlus, action: (c) => useTileEdit.getState().edit(c.id.startsWith('neg-') ? 'new-neg' : 'new', '', c.id) },
  { id: 'generate', label: '✦ Generate snippets', icon: IconSparkles, visible: (c) => !!generateSnippetsFor(c.id), action: (c) => generateSnippetsFor(c.id)?.() },
  { id: 'manage', label: 'Manage…', icon: IconSettings, action: (c) => useTileEdit.getState().openManage(c.id) },
  { id: 'up', label: 'Move up', icon: IconArrowUp, group: 'order', visible: (c) => c.id !== UNCATEGORIZED, enabled: (c) => !!neighbour(c, -1), action: (c) => { const n = neighbour(c, -1); if (n) reorderCategory(n.from, n.to); } },
  { id: 'down', label: 'Move down', icon: IconArrowDown, group: 'order', visible: (c) => c.id !== UNCATEGORIZED, enabled: (c) => !!neighbour(c, 1), action: (c) => { const n = neighbour(c, 1); if (n) reorderCategory(n.from, n.to); } },
  { id: 'delete', label: 'Delete category', icon: IconTrash, danger: true, group: 'danger', visible: (c) => c.id !== UNCATEGORIZED, action: (c) => deleteCategory(c.id) },
]);
