/**
 * The Collections row under the history filters (FIXLIST 21, Donny's sketch): one square tile per
 * collection, then "+" (a new one; a picture dropped on "+" starts one holding it). Scrolls
 * sideways (the mouse wheel too), with an edge fade while more tiles are off-screen. Collections hold any picture: results, imports from outside, model pictures.
 */
import { useCallback } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useEdgeFade, useWheelSideways } from '~/ui';
import { useStore } from '@/lib/store';
import { useImageDrop, useRegisterDropTarget } from '~/dnd';
import { CollectionTile, TILE } from './CollectionTile';
import { newCollection, newCollectionWith, setActiveCollection, useCollectionsUi } from './collectionActions';
import { coverId, shownIds } from './collectionsLogic';

export interface ItemLookup {
  exists: (id: string) => boolean;
  url: (id: string) => string;
  isVideo: (id: string) => boolean;
}

function PlusTile() {
  const drop = useImageDrop({ onDrop: (item) => void newCollectionWith(item) });
  useRegisterDropTarget({ id: 'collection:new', label: 'New collection', group: 'collection', order: 99, onDrop: (item) => void newCollectionWith(item) });
  return (
    <button type="button" {...drop.props} onClick={() => newCollection()} aria-label="New collection" title="New collection · or drop a picture here to start one"
      style={{
        width: TILE, height: TILE, flex: 'none', borderRadius: 14, cursor: 'pointer', display: 'grid', placeItems: 'center',
        border: `2px dashed ${drop.over ? 'var(--il-ember)' : drop.active ? 'var(--il-ember-line)' : 'var(--il-line-strong)'}`,
        background: drop.over ? 'var(--il-ember-soft)' : 'transparent', color: drop.over ? 'var(--il-ember-hi)' : 'var(--il-muted)',
      }}>
      <IconPlus size={20} stroke={2.4} />
    </button>
  );
}

export function CollectionsRow({ lookup }: { lookup: ItemLookup }) {
  const collections = useStore((s) => s.collections);
  const active = useCollectionsUi((s) => s.active);
  // Item 23: an up/down wheel scrolls the row sideways; an edge fades while more tiles hide that way.
  const wheel = useWheelSideways<HTMLDivElement>();
  const fade = useEdgeFade<HTMLDivElement>();
  const fadeRef = fade.ref;
  const ref = useCallback((el: HTMLDivElement | null) => { wheel(el); fadeRef(el); }, [wheel, fadeRef]);
  return (
    <div ref={ref} className="il-scroll-x" data-no-swipe aria-label="Collections" role="group"
      style={{ display: 'flex', gap: 8, padding: '8px 12px 10px', flex: 'none', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x pan-y', ...fade.style }}>
      {collections.map((c) => {
        const cov = coverId(c, lookup.exists);
        return (
          <CollectionTile key={c.id} c={c} count={shownIds(c, lookup.exists).length} active={active === c.id}
            cover={cov ? lookup.url(cov) : ''} coverIsVideo={cov ? lookup.isVideo(cov) : false}
            onPick={() => setActiveCollection(active === c.id ? null : c.id)} />
        );
      })}
      <PlusTile />
    </div>
  );
}
