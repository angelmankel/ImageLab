/**
 * Mobile pass (m-browse): every collection (and "New collection") as a Send-to target, whatever
 * is on screen. They were registered by the history panel's collection tiles, which never mount on
 * a phone, so a long-press → Send to never listed a collection there. Mounted once in App.
 * Renders nothing.
 */
import type { Collection } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useRegisterDropTarget } from '~/dnd';
import { addImageToCollection, newCollectionWith } from './collectionActions';

function One({ c }: { c: Collection }): null {
  useRegisterDropTarget({ id: `collection:${c.id}`, label: `Collection · ${c.name}`, group: 'collection', onDrop: (item) => void addImageToCollection(c.id, item) }, [c.name]);
  return null;
}

export function CollectionTargets() {
  const collections = useStore((s) => s.collections);
  useRegisterDropTarget({ id: 'collection:new', label: 'New collection', group: 'collection', order: 99, onDrop: (item) => void newCollectionWith(item) });
  return <>{collections.map((c) => <One key={c.id} c={c} />)}</>;
}
