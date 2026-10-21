/**
 * Library (rule 12): "Add to collection ▾" for one item or a bulk selection. Each collection is a
 * toggle (✓ when every item is in it already: a tap takes them out); + New collection adds them
 * to a fresh one. The target must be a ref-able element (a native button).
 */
import type { ReactElement } from 'react';
import { Menu } from '@mantine/core';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { T } from '~/theme/tokens';
import type { LibItem } from './libraryLogic';
import { addToCollection, newCollection, removeFromCollection } from './libraryActions';
import { vh } from '~/theme/uiScale';

export function AddToCollectionMenu({ items, children, position = 'bottom-end' }: { items: readonly LibItem[]; children: ReactElement; position?: 'bottom-end' | 'top-end' | 'top' | 'bottom' }) {
  const collections = useStore((s) => s.collections);
  return (
    <Menu position={position} zIndex={T.z.popover} width={230} radius={T.radius.md} shadow="lg" disabled={!items.length}>
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown style={{ maxHeight: vh(50), overflowY: 'auto', touchAction: 'pan-y' }}>
        {collections.length === 0 && <Menu.Label>No collections yet</Menu.Label>}
        {collections.map((c) => {
          const all = items.length > 0 && items.every((i) => c.itemIds.includes(i.key));
          return (
            <Menu.Item key={c.id} leftSection={<span style={{ width: 15, textAlign: 'center' }}>{c.icon || '•'}</span>}
              rightSection={all ? <IconCheck size={14} color="var(--il-ember)" /> : null}
              onClick={() => (all ? removeFromCollection(c.id, items) : addToCollection(c.id, items))}
              style={{ fontWeight: all ? 800 : 600 }}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Menu.Item leftSection={<IconPlus size={15} />} onClick={() => newCollection(items)} style={{ color: 'var(--il-ok)', fontWeight: 700 }}>New collection</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
