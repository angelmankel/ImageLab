/**
 * The History page's tiles open the app's picture menu ('history-image': Show, ♥, prompt,
 * settings, Send to step, Move to collection, Download, Delete …) on right-click and on a phone
 * long-press (mobile pass). This adds the page's own entry: "Select" = Select mode with this tile
 * picked (the touch way into multi-select).
 */
import { IconSquareCheck } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import type { HistoryEntry } from '@/lib/types';
import type { LibItem } from './libraryLogic';
import { useLibrary } from './libraryStore';

/** What a Library tile hands the menu: the shape of a history tile + the page's own hook. */
export interface LibMenuTarget {
  key: string; url: string; filename: string; kind: 'image' | 'video'; liked: boolean;
  entry: HistoryEntry | null; entryId?: string;
  /** Present only on the History page's tiles. */
  libSelect?: () => void;
}

export function libMenuTarget(item: LibItem): LibMenuTarget {
  return {
    key: item.key, url: item.url, filename: item.filename, kind: item.kind, liked: item.liked,
    entry: item.entry ?? null, entryId: item.entry?.id,
    libSelect: () => { const s = useLibrary.getState(); s.setSelecting(true); s.togglePick(item.key); },
  };
}

registerMenu<LibMenuTarget>('history-image', [
  { id: 'lib-select', label: 'Select', icon: IconSquareCheck, group: 'view', order: 5, visible: (t) => !!t.libSelect && !useLibrary.getState().selecting, action: (t) => t.libSelect?.() },
]);
