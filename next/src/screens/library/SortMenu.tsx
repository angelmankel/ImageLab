/** Library (rule 12): sort — Newest · Oldest · Favourites first. */
import { Menu } from '@mantine/core';
import { IconArrowsSort, IconCheck } from '@tabler/icons-react';
import { MenuPill } from './MenuPill';
import { T } from '~/theme/tokens';
import { useLibrary } from './libraryStore';
import type { SortKey } from './libraryLogic';

const LABEL: Record<SortKey, string> = { newest: 'Newest', oldest: 'Oldest', favourites: 'Favourites first' };

export function SortMenu({ iconOnly }: { iconOnly?: boolean }) {
  const sort = useLibrary((s) => s.sort);
  const setSort = useLibrary((s) => s.setSort);
  return (
    <Menu position="bottom-end" zIndex={T.z.popover} width={190} radius={T.radius.md} shadow="lg">
      <Menu.Target>
        <MenuPill title="Sort" aria-label={`Sort: ${LABEL[sort]}`} style={{ gap: 6, padding: iconOnly ? '0 11px' : undefined }}>
          {iconOnly ? <IconArrowsSort size={15} /> : <>{LABEL[sort]}<span style={{ color: 'var(--il-muted)' }}>▾</span></>}
        </MenuPill>
      </Menu.Target>
      <Menu.Dropdown>
        {(Object.keys(LABEL) as SortKey[]).map((k) => (
          <Menu.Item key={k} onClick={() => setSort(k)} rightSection={sort === k ? <IconCheck size={14} color="var(--il-ember)" /> : null}
            style={{ fontWeight: sort === k ? 800 : 600 }}>{LABEL[k]}</Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
