/**
 * Collections in the history panel (FIXLIST 21): the actions, plain functions callable from any
 * handler (tiles, drops, menus, other screens). `addImageToCollection` is the API other owners use
 * (canvas viewer, models): it takes any picture — a history image (by entry id), a video /
 * workflow result (by its key), or anything else by URL / file, which is imported (bytes kept in
 * the browser, so it survives a pod wipe) — and MOVES it into the collection.
 */
import { notifications } from '@mantine/notifications';
import { create } from 'zustand';
import { useStore } from '@/lib/store';
import type { Collection } from '@/lib/types';
import { runStoreOf } from '~/app/deleteResult';
import { undoNote } from '~/app/undoNote';
import { dropToBlob, type DropItem } from '~/dnd';
import { moveInto, nextName, removeEverywhere, restoreAt } from './collectionsLogic';

interface UiState {
  /** The collection the history grid shows (null = the normal history). */
  active: string | null;
  /** The tile whose name is being edited. */
  renaming: string | null;
}
export const useCollectionsUi = create<UiState>(() => ({ active: null, renaming: null }));
export const setActiveCollection = (id: string | null) => useCollectionsUi.setState({ active: id });
export const startRename = (id: string | null) => useCollectionsUi.setState({ renaming: id });

const setCollections = (collections: Collection[]) => useStore.setState({ collections });
const nameOf = (id: string) => useStore.getState().collections.find((c) => c.id === id)?.name ?? 'the collection';

/** "+": a new collection with a free name ("Collection 3"); its name is open for typing, not required. */
export function newCollection(opts: { rename?: boolean } = {}): string {
  const id = useStore.getState().createCollection(nextName(useStore.getState().collections));
  if (opts.rename !== false) startRename(id);
  return id;
}

export function renameCollection(id: string, name: string): void {
  useStore.getState().renameCollection(id, name);
}

/** ×: the collection goes, its pictures stay (back to "no collection"). Undo for 3 s. */
export function deleteCollection(id: string): void {
  const list = useStore.getState().collections;
  const index = list.findIndex((c) => c.id === id);
  if (index < 0) return;
  const gone = list[index];
  useStore.getState().deleteCollection(id);
  if (useCollectionsUi.getState().active === id) setActiveCollection(null);
  undoNote(`${gone.name} deleted · pictures kept`, () => setCollections(restoreAt(useStore.getState().collections, gone, index)));
}

/** Move an item id (history entry id, run key or imported id) into a collection. */
export function moveItem(collectionId: string, itemId: string): void {
  setCollections(moveInto(useStore.getState().collections, collectionId, itemId));
}

/** Back to "no collection". */
export function removeFromCollections(itemId: string): void {
  setCollections(removeEverywhere(useStore.getState().collections, itemId));
}

async function sizeOf(blob: Blob): Promise<{ width: number; height: number }> {
  if (!blob.type.startsWith('image/') || typeof createImageBitmap !== 'function') return { width: 0, height: 0 };
  try {
    const bmp = await createImageBitmap(blob);
    const s = { width: bmp.width, height: bmp.height };
    bmp.close();
    return s;
  } catch { return { width: 0, height: 0 }; }
}

export interface CollectableImage {
  url: string;
  name?: string;
  /** A history entry id (an image result). */
  entryId?: string;
  /** A run result's key (video / workflow results are keyed by url). */
  key?: string;
}

/** Which id a picture already has in the app, or null when it must be imported. */
function knownId(img: CollectableImage): string | null {
  const st = useStore.getState();
  if (img.entryId && st.history.some((h) => h.id === img.entryId)) return img.entryId;
  if (img.key && st.history.some((h) => h.id === img.key)) return img.key;
  const runKey = img.key ?? img.url;
  if (runKey && runStoreOf(runKey)) return runKey;
  if (img.key && st.importedImages.some((i) => i.id === img.key)) return img.key;
  return null;
}

/**
 * Put any picture into a collection (moved out of any other). Pictures from outside the app's
 * results are imported first. Shows a short note; returns false when it failed.
 */
export async function addImageToCollection(collectionId: string, img: CollectableImage | DropItem): Promise<boolean> {
  const name = nameOf(collectionId);
  try {
    let id: string | null = null;
    if ('kind' in img && (img.kind === 'file' || img.kind === 'url')) {
      const drop = img as DropItem;
      if (drop.kind === 'url' && drop.payload) id = knownId({ url: drop.url, name: drop.name, entryId: drop.payload.entryId, key: drop.payload.key });
      else if (drop.kind === 'url') id = knownId({ url: drop.url });
      if (!id) {
        const { blob, name: fileName } = await dropToBlob(drop);
        id = (await useStore.getState().addImportedImage(blob, { name: fileName, ...(await sizeOf(blob)) })).id;
      }
    } else {
      const c = img as CollectableImage;
      id = knownId(c);
      if (!id) {
        const { blob, name: fileName } = await dropToBlob({ kind: 'url', url: c.url, name: c.name ?? 'image.png', payload: null });
        id = (await useStore.getState().addImportedImage(blob, { name: fileName, ...(await sizeOf(blob)) })).id;
      }
    }
    if (!useStore.getState().collections.some((c) => c.id === collectionId)) return false;
    moveItem(collectionId, id);
    notifications.show({ message: `Moved to ${name}`, autoClose: 2000 });
    return true;
  } catch (err) {
    notifications.show({ color: 'red', title: `Could not add it to ${name}`, message: err instanceof Error ? err.message : String(err), autoClose: 3000 });
    return false;
  }
}

/** Dropped on "+": a new collection holding the picture. */
export async function newCollectionWith(img: CollectableImage | DropItem): Promise<void> {
  const id = newCollection({ rename: false });
  const ok = await addImageToCollection(id, img);
  if (!ok) useStore.getState().deleteCollection(id);
}
