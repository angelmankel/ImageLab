/**
 * Right-click / long-press on a history tile (FIXLIST 45): show, full screen, favourite, use the
 * prompt / settings, send to a step, download, copy the address, delete (with Undo).
 * Target = the tile (`Tile<HistoryEntry>` from screens/image/historyLogic). Others extend
 * 'history-image' (new session from it, remove background, collections …).
 */
import {
  IconArrowsMaximize, IconCopy, IconDownload, IconEye, IconHeart, IconSend, IconSettings, IconTextCaption, IconTrash,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import { reuseSettingsFrom, sendToStep, usePromptFrom } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { useSteps, stepTitle, STEP_LABEL } from '~/app/stepsStore';
import { useStage } from '~/screens/image/stageStore';
import type { Tile } from '~/screens/image/historyLogic';
import { registerMenu, type MenuEntry } from '../registry';

type T = Tile<HistoryEntry>;

function show(t: T) {
  if (t.entry) { useStore.getState().selectHistoryEntry(t.entry); useStage.getState().showRun(null); }
  else useStage.getState().showRun(t.key);
}

function download(t: T) {
  const a = document.createElement('a');
  a.href = t.url;
  a.download = t.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const sendTargets = (t: T): MenuEntry<T>[] => useSteps.getState().steps.map((s, _i, all) => ({
  id: `send-${s.id}`, label: s.name && s.name !== STEP_LABEL[s.kind] ? `${stepTitle(all, s.id)} · ${s.name}` : stepTitle(all, s.id),
  action: () => sendToStep({ url: t.url, entry: t.entry ?? undefined }, s.id),
}));

registerMenu<T>('history-image', [
  { id: 'show', label: 'Show', icon: IconEye, group: 'view', action: show },
  {
    id: 'fullscreen', label: 'Full screen', icon: IconArrowsMaximize, group: 'view', visible: (t) => !!t.entry,
    action: (t) => { show(t); useStore.getState().openViewer(); },
  },
  {
    id: 'like', label: 'Favourite', icon: IconHeart, group: 'view', visible: (t) => !!t.entry, checked: (t) => !!t.liked,
    action: (t) => useStore.getState().toggleHistoryLiked(t.entry!.id),
  },
  { id: 'prompt', label: 'Use its prompt', icon: IconTextCaption, group: 'reuse', visible: (t) => !!t.entry, action: (t) => usePromptFrom(t.entry!) },
  { id: 'settings', label: 'Use its settings', icon: IconSettings, group: 'reuse', visible: (t) => !!t.entry, action: (t) => reuseSettingsFrom(t.entry!) },
  { id: 'send', label: 'Send to step', icon: IconSend, group: 'reuse', visible: (t) => t.kind === 'image', submenu: sendTargets },
  { id: 'download', label: 'Download', icon: IconDownload, group: 'file', action: download },
  { id: 'copy', label: 'Copy address', icon: IconCopy, group: 'file', action: (t) => navigator.clipboard?.writeText(new URL(t.url, location.href).href).catch(() => undefined) },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, shortcut: 'Del', action: (t) => deleteOutput(t) },
]);
