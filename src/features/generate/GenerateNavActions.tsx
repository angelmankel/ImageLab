import { useCallback } from 'react';
import { Divider, Group } from '@mantine/core';
import {
  IconInfinity, IconInfoCircle, IconMaximize, IconStar, IconStarFilled, IconTrash,
} from '@tabler/icons-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useStore } from '@/lib/store';
import { sendEntryToCanvas } from '@/features/canvas/sendEntryToCanvas';
import { RecallButton } from '@/features/layout/RecallButton';
import { DownloadSelectedButton } from '@/features/layout/DownloadSelectedButton';
import { ToolbarButton } from './ToolbarButton';

/**
 * The image toolbar in the generate top nav — v1's ImagePanelToolbar: one
 * compact group of subtle icon buttons acting on whichever history entry is
 * shown on the stripped canvas (selected, else newest), with delete split off
 * behind a divider. Lives inside <ConfirmProvider>, so useConfirm() is safe.
 */
export function GenerateNavActions() {
  const selectedEntry = useStore(s => s.selectedEntry);
  const newest = useStore(s => s.history[0] ?? null);
  const toggleHistoryLiked = useStore(s => s.toggleHistoryLiked);
  const removeHistoryEntry = useStore(s => s.removeHistoryEntry);
  const openViewer = useStore(s => s.openViewer);
  const selectHistoryEntry = useStore(s => s.selectHistoryEntry);
  const confirm = useConfirm();
  const entry = selectedEntry ?? newest;
  const disabled = !entry;
  const liked = !!entry?.liked;

  const deleteCurrent = useCallback(async () => {
    if (!entry) return;
    const ok = await confirm({
      message: 'Delete this image?',
      confirmLabel: 'Delete',
      dontAskAgainKey: 'history.deleteEntry',
    });
    if (!ok) return;
    // Compute the neighbour we want to promote BEFORE removeHistoryEntry
    // rewrites the list — history is newest-first so the older entry
    // (idx + 1) slides into the deleted slot; fall back to the newer one
    // when the deleted entry was the oldest. Explicit select handles the
    // "viewing-newest-by-fallback, selectedEntry is null" case too.
    const list = useStore.getState().history;
    const idx = list.findIndex(h => h.id === entry.id);
    const neighbour = idx >= 0 ? (list[idx + 1] ?? list[idx - 1] ?? null) : null;
    removeHistoryEntry(entry.id);
    selectHistoryEntry(neighbour);
  }, [entry, confirm, removeHistoryEntry, selectHistoryEntry]);

  // Delete / Backspace fire the same flow as the trash button. skipTyping
  // protects all the prompt textareas; the fullscreen viewer + history panel
  // overlays sit at higher priority bands so they win when open.
  useShortcut(['Delete', 'Backspace'], (e) => {
    if (!entry) return;
    e.preventDefault();
    void deleteCurrent();
  }, { priority: ShortcutPriority.Global, when: () => !!entry });

  return (
    <Group gap={4} wrap="nowrap">
      <RecallButton />
      <ToolbarButton
        icon={liked
          ? <IconStarFilled size={16} color="var(--mantine-color-yellow-5)" />
          : <IconStar size={16} />}
        label={liked ? 'Unfavorite image' : 'Favorite image'}
        tooltip={liked ? 'Remove from favorites' : 'Add to favorites'}
        pressed={liked}
        onClick={() => { if (entry) toggleHistoryLiked(entry.id); }}
        disabled={disabled}
      />
      <DownloadSelectedButton />
      <ToolbarButton
        icon={<IconInfinity size={16} />}
        label="Send image to canvas"
        tooltip="Send this image to the infinite canvas as a new image layer"
        onClick={() => { if (entry) void sendEntryToCanvas(entry); }}
        disabled={disabled}
      />
      <ToolbarButton
        icon={<IconInfoCircle size={16} />}
        label="Open image info"
        tooltip="Open the selected image with its details"
        onClick={() => openViewer({ withInfo: true })}
        disabled={disabled}
      />
      <ToolbarButton
        icon={<IconMaximize size={16} />}
        label="View image fullscreen"
        tooltip="View image fullscreen (Space)"
        onClick={() => openViewer()}
        disabled={disabled}
      />
      <Divider orientation="vertical" h={18} mx={6} style={{ alignSelf: 'center' }} />
      <ToolbarButton
        icon={<IconTrash size={16} />}
        label="Delete image"
        tooltip="Delete this image from history (Del)"
        onClick={() => { void deleteCurrent(); }}
        disabled={disabled}
      />
    </Group>
  );
}
