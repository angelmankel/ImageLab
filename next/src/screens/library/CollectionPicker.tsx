/**
 * Library (rule 12): the collection picker, "All items ▾". A Mantine Menu: All items, Favourites,
 * each collection (with counts), + New collection; Delete for the open collection.
 */
import { useMemo, type ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconFolder, IconPlus, IconStar, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { T } from '~/theme/tokens';
import { useLibrary } from './libraryStore';
import { bucketCounts, bucketLabel, type LibItem } from './libraryLogic';
import { newCollection } from './libraryActions';
import { MenuPill } from './MenuPill';

export function CollectionPicker({ all, compact }: { all: LibItem[]; compact?: boolean }) {
  const bucket = useLibrary((s) => s.bucket);
  const setBucket = useLibrary((s) => s.setBucket);
  const collections = useStore((s) => s.collections);
  const counts = useMemo(() => bucketCounts(all, collections), [all, collections]);
  const label = bucketLabel(bucket, collections);
  const current = collections.find((c) => c.id === bucket);

  const deleteCurrent = () => {
    if (!current) return;
    modals.openConfirmModal({
      title: `Delete “${current.name}”?`,
      children: <span style={{ fontSize: 13, color: 'var(--il-fg2)' }}>Only the collection goes; its pictures stay in your history.</span>,
      labels: { confirm: 'Delete collection', cancel: 'Cancel' },
      confirmProps: { color: 'red' }, centered: true, zIndex: T.z.confirm,
      onConfirm: () => { useStore.getState().deleteCollection(current.id); setBucket('all'); },
    });
  };

  return (
    <Menu position="bottom-start" zIndex={T.z.popover} width={240} radius={T.radius.md} shadow="lg">
      <Menu.Target>
        <MenuPill on={bucket !== 'all'} light title="Collection" style={{ padding: compact ? '0 12px' : undefined, maxWidth: compact ? 150 : 220 }}>
          <IconFolder size={15} stroke={2.2} color="var(--il-muted)" style={{ flex: 'none' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ color: 'var(--il-muted)' }}>▾</span>
        </MenuPill>
      </Menu.Target>
      <Menu.Dropdown style={{ maxHeight: '60vh', overflowY: 'auto', touchAction: 'pan-y' }}>
        <Row on={bucket === 'all'} icon={<IconFolder size={15} />} label="All items" n={counts.all} onClick={() => setBucket('all')} />
        <Row on={bucket === 'favourites'} icon={<IconStar size={15} />} label="Favourites" n={counts.favourites} onClick={() => setBucket('favourites')} />
        {collections.length > 0 && <Menu.Divider />}
        {collections.map((c) => (
          <Row key={c.id} on={bucket === c.id} icon={<span style={{ width: 15, textAlign: 'center' }}>{c.icon || '•'}</span>} label={c.name} n={counts[c.id] ?? 0} onClick={() => setBucket(c.id)} />
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconPlus size={15} />} onClick={() => newCollection()} style={{ color: 'var(--il-ok)', fontWeight: 700 }}>New collection</Menu.Item>
        {current && <Menu.Item leftSection={<IconTrash size={15} />} color="red" onClick={deleteCurrent}>Delete “{current.name}”</Menu.Item>}
      </Menu.Dropdown>
    </Menu>
  );
}

function Row({ on, icon, label, n, onClick }: { on: boolean; icon: ReactNode; label: string; n: number; onClick: () => void }) {
  return (
    <Menu.Item leftSection={icon} onClick={onClick}
      rightSection={<span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--il-muted)', fontSize: 11, fontWeight: 700 }}>{n}{on && <IconCheck size={14} color="var(--il-ember)" />}</span>}
      style={{ fontWeight: on ? 800 : 600, color: on ? 'var(--il-fg)' : 'var(--il-fg2)' }}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </Menu.Item>
  );
}
