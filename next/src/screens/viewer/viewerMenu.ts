/**
 * Item 30 + 45: the viewer picture's right-click / long-press menu, and the phone's "⋯": send to a
 * step or a new step, a new session, Remove BG, reuse, copy / download, delete.
 */
import { IconBackground, IconCopyPlus, IconDownload, IconHistory, IconSend, IconSettings, IconTextCaption, IconTrash } from '@tabler/icons-react';
import { registerMenu, type MenuEntry } from '~/app/contextMenu';
import { recallFrom, reuseSettingsFrom, usePromptFrom } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { removeBgFrom, useRemoveBg } from '~/app/removeBgAction';
import { newSessionFromImage } from '~/app/sessionsStore';
import { downloadUrl, sendSubmenu } from '~/screens/image/canvasMenu';
import type { ViewerItem } from './types';

export interface ViewerMenuTarget { item: ViewerItem; onClose: () => void }

const img = (t: ViewerMenuTarget) => t.item.kind === 'image';
const hasEntry = (t: ViewerMenuTarget) => !!t.item.entry;

registerMenu<ViewerMenuTarget>('viewer-image', [
  { id: 'send', label: 'Send to', icon: IconSend, group: 'send', visible: img, submenu: (t) => sendSubmenu(t.item.url, t.item.entry ?? null, t.item.filename)().map((e): MenuEntry<ViewerMenuTarget> => ({ ...e, action: (_x, ctx) => { t.onClose(); e.action?.(undefined, ctx); } })) },
  { id: 'session', label: 'New session from it', icon: IconCopyPlus, group: 'send', action: (t) => { t.onClose(); newSessionFromImage({ url: t.item.url, key: t.item.key, entryId: t.item.entry?.id, entry: t.item.entry ?? null, name: t.item.filename }); } },
  {
    id: 'removebg', label: 'Remove background', icon: IconBackground, group: 'edit', visible: img,
    enabled: (t) => !useRemoveBg.getState().busy[t.item.url] || 'Already running',
    action: (t) => void removeBgFrom({ url: t.item.url, filename: t.item.filename, entry: t.item.entry ?? null }),
  },
  { id: 'recall', label: 'Recall everything', icon: IconHistory, group: 'reuse', visible: hasEntry, action: (t) => recallFrom(t.item.entry!) },
  { id: 'prompt', label: 'Use its prompt', icon: IconTextCaption, group: 'reuse', visible: hasEntry, action: (t) => usePromptFrom(t.item.entry!) },
  { id: 'settings', label: 'Use its settings', icon: IconSettings, group: 'reuse', visible: hasEntry, action: (t) => reuseSettingsFrom(t.item.entry!) },
  { id: 'download', label: 'Download', icon: IconDownload, group: 'file', action: (t) => downloadUrl(t.item.url, t.item.filename) },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, shortcut: 'Del', action: (t) => deleteOutput({ entry: t.item.entry ?? null, url: t.item.url }) },
]);
