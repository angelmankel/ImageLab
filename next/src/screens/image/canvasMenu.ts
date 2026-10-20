/**
 * Right-click / long-press on the canvas picture (items 23 + 45): full screen, the zoom steps,
 * Compare, Remove BG, favourite, reuse its prompt / settings / everything, send to a step, a new
 * step from it, download, copy, delete (with Undo). Also adds Remove BG to the history tiles'
 * menu ('history-image'). Registered when the stage module loads.
 */
import {
  IconArrowsMaximize, IconBackground, IconColumns2, IconCopy, IconDownload, IconHeart, IconHistory, IconMaximize,
  IconPlus, IconSend, IconSettings, IconTextCaption, IconTrash, IconZoomIn, IconZoomOut,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/types';
import type { ResultItem } from '@/lib/workspace';
import { registerMenu, type MenuEntry } from '~/app/contextMenu';
import { recallFrom, reuseSettingsFrom, sendToStep, usePromptFrom } from '~/app/actions';
import { deleteOutput } from '~/app/deleteResult';
import { removeBgFrom, useRemoveBg } from '~/app/removeBgAction';
import { addStepAfter, useSteps, stepTitle, STEP_LABEL, ADDABLE_KINDS, STEP_IO, type StepKind } from '~/app/stepsStore';
import type { Tile } from './historyLogic';
import type { StageMedia } from './useStageMedia';
import { useStage } from './stageStore';

export interface CanvasTarget {
  item: ResultItem;
  entry: HistoryEntry | null;
  fit: () => void; zoomIn: () => void; zoomOut: () => void;
  openFull: () => void;
  canCompare: boolean;
}

export function canvasTarget(media: StageMedia, zoom: { fit: () => void; zoomIn: () => void; zoomOut: () => void }, openFull: () => void): CanvasTarget {
  return {
    item: media.item!, entry: media.source === 'image' ? media.entry : null,
    fit: zoom.fit, zoomIn: zoom.zoomIn, zoomOut: zoom.zoomOut, openFull,
    canCompare: media.items.filter((i) => i.kind === 'image').length > 1,
  };
}

export function downloadUrl(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

const isImage = (t: CanvasTarget) => t.item.kind === 'image';

/** Step kinds that take a picture (the I/O standard's `needs`). */
const takesImage = (k: StepKind) => STEP_IO[k].needs !== 'none';

export const sendSubmenu = (url: string, entry: HistoryEntry | null, name: string) => (): MenuEntry[] => [
  ...useSteps.getState().steps.map((s, _i, all) => ({
    id: `send-${s.id}`, group: 'steps',
    label: s.name && s.name !== STEP_LABEL[s.kind] ? `${stepTitle(all, s.id)} · ${s.name}` : stepTitle(all, s.id),
    action: () => sendToStep({ url, entry: entry ?? undefined }, s.id),
  })),
  ...ADDABLE_KINDS.filter(takesImage).map((k) => ({
    id: `new-${k}`, group: 'new', icon: IconPlus, label: `New ${STEP_LABEL[k]} step`,
    action: () => { addStepAfter(k, { input: { url, name } }); },
  })),
];

registerMenu<CanvasTarget>('canvas-image', [
  { id: 'full', label: 'Full screen', icon: IconMaximize, group: 'view', action: (t) => t.openFull() },
  { id: 'fit', label: 'Fit to view', icon: IconArrowsMaximize, group: 'view', visible: isImage, action: (t) => t.fit() },
  { id: 'zin', label: 'Zoom in', icon: IconZoomIn, group: 'view', visible: isImage, action: (t) => t.zoomIn() },
  { id: 'zout', label: 'Zoom out', icon: IconZoomOut, group: 'view', visible: isImage, action: (t) => t.zoomOut() },
  { id: 'compare', label: 'Compare', icon: IconColumns2, group: 'view', visible: isImage, enabled: (t) => t.canCompare || 'Needs a second result', checked: () => useStage.getState().compare, action: () => { const s = useStage.getState(); s.setCompare(!s.compare); } },
  {
    id: 'removebg', label: 'Remove background', icon: IconBackground, group: 'edit', visible: isImage,
    enabled: (t) => !useRemoveBg.getState().busy[t.item.url] || 'Already running',
    action: (t) => void removeBgFrom({ url: t.item.url, filename: t.item.filename, entry: t.entry }),
  },
  { id: 'like', label: 'Favourite', icon: IconHeart, group: 'reuse', visible: (t) => !!t.entry, checked: (t) => !!t.entry?.liked, action: (t) => useStore.getState().toggleHistoryLiked(t.entry!.id) },
  { id: 'prompt', label: 'Use its prompt', icon: IconTextCaption, group: 'reuse', visible: (t) => !!t.entry, action: (t) => usePromptFrom(t.entry!) },
  { id: 'settings', label: 'Use its settings', icon: IconSettings, group: 'reuse', visible: (t) => !!t.entry, action: (t) => reuseSettingsFrom(t.entry!) },
  { id: 'recall', label: 'Recall everything', icon: IconHistory, group: 'reuse', visible: (t) => !!t.entry, action: (t) => recallFrom(t.entry!) },
  { id: 'send', label: 'Send to', icon: IconSend, group: 'reuse', visible: isImage, submenu: (t) => sendSubmenu(t.item.url, t.entry, t.item.filename)() },
  { id: 'download', label: 'Download', icon: IconDownload, group: 'file', action: (t) => downloadUrl(t.item.url, t.item.filename) },
  { id: 'copy', label: 'Copy address', icon: IconCopy, group: 'file', action: (t) => navigator.clipboard?.writeText(new URL(t.item.url, location.href).href).catch(() => undefined) },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', order: 100, shortcut: 'Del', action: (t) => deleteOutput({ entry: t.entry, url: t.item.url }) },
]);

registerMenu<Tile<HistoryEntry>>('history-image', [
  {
    id: 'removebg', label: 'Remove background', icon: IconBackground, group: 'reuse', visible: (t) => t.kind === 'image',
    enabled: (t) => !useRemoveBg.getState().busy[t.url] || 'Already running',
    action: (t) => void removeBgFrom({ url: t.url, filename: t.filename, entry: t.entry }),
  },
]);
