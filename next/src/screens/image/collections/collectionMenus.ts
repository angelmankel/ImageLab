/**
 * Menus for Collections (FIXLIST 21 + 45): right-click / long-press a collection tile (show,
 * rename, delete), and on a history picture "Move to collection ▸" / "Remove from collection".
 */
import { IconEye, IconFolderPlus, IconFolderMinus, IconFolderSymlink, IconPencil, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Collection } from '@/lib/types';
import { registerMenu, type MenuEntry } from '~/app/contextMenu';
import { collectionOf } from './collectionsLogic';
import {
  addImageToCollection, deleteCollection, newCollectionWith, removeFromCollections, setActiveCollection, startRename, useCollectionsUi,
} from './collectionActions';

registerMenu<Collection>('collection', [
  {
    id: 'show', label: (c) => (useCollectionsUi.getState().active === c.id ? 'Back to the history' : 'Show'), icon: IconEye, group: 'view',
    action: (c) => setActiveCollection(useCollectionsUi.getState().active === c.id ? null : c.id),
  },
  { id: 'rename', label: 'Rename', icon: IconPencil, group: 'edit', action: (c) => startRename(c.id) },
  { id: 'delete', label: 'Delete (pictures stay)', icon: IconTrash, danger: true, group: 'danger', action: (c) => deleteCollection(c.id) },
]);

/** What a history tile hands the menu (`Tile` from historyLogic: key, url, filename, entryId). */
interface PictureLike { key: string; url: string; filename: string; entryId?: string }

const moveTargets = (t: PictureLike): MenuEntry<PictureLike>[] => {
  const st = useStore.getState();
  const current = collectionOf(st.collections, t.entryId ?? t.key);
  return [
    ...st.collections.map((c) => ({
      id: `to-${c.id}`, label: c.name, checked: () => current?.id === c.id,
      enabled: () => current?.id !== c.id,
      action: () => void addImageToCollection(c.id, { url: t.url, name: t.filename, entryId: t.entryId, key: t.key }),
    })),
    { id: 'to-new', label: 'New collection', icon: IconFolderPlus, group: 'new', action: () => void newCollectionWith({ url: t.url, name: t.filename, entryId: t.entryId, key: t.key }) },
  ];
};

registerMenu<PictureLike>('history-image', [
  { id: 'collection-move', label: 'Move to collection', icon: IconFolderSymlink, group: 'collection', order: 50, submenu: moveTargets },
  {
    id: 'collection-remove', label: (t) => `Remove from ${collectionOf(useStore.getState().collections, t.entryId ?? t.key)?.name ?? 'collection'}`,
    icon: IconFolderMinus, group: 'collection', order: 50,
    visible: (t) => !!collectionOf(useStore.getState().collections, t.entryId ?? t.key),
    action: (t) => removeFromCollections(t.entryId ?? t.key),
  },
]);
