/**
 * Library (rule 12): the Select-mode bar, its own row under the top row (nothing sits on the
 * pictures): "3 selected" · All · None | Add to collection ▾ · ★ · Download · Delete · Done.
 */
import { useMemo } from 'react';
import { IconDownload, IconFolderPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { IconBtn, Sep } from '~/ui';
import { useLibrary } from './libraryStore';
import type { LibItem } from './libraryLogic';
import { confirmDelete, downloadMany, favMany } from './libraryActions';
import { AddToCollectionMenu } from './AddToCollectionMenu';
import { MenuPill } from './MenuPill';
import { zipItems } from './zip';

export function BulkBar({ visible, phone }: { visible: LibItem[]; phone?: boolean }) {
  const picked = useLibrary((s) => s.picked);
  const setPicked = useLibrary((s) => s.setPicked);
  const setSelecting = useLibrary((s) => s.setSelecting);
  const items = useMemo(() => { const k = new Set(picked); return visible.filter((i) => k.has(i.key)); }, [picked, visible]);
  const n = items.length;
  const allStarred = n > 0 && items.every((i) => i.liked);
  const h = phone ? 34 : 36;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: phone ? 'wrap' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: n ? 'var(--il-ember-hi)' : 'var(--il-muted)', padding: '0 4px', whiteSpace: 'nowrap' }}>{n} selected</span>
      <MenuPill h={h} onClick={() => setPicked(visible.map((i) => i.key))} style={{ padding: '0 12px' }}>All</MenuPill>
      <MenuPill h={h} onClick={() => setPicked([])} disabled={!n} style={{ padding: '0 12px', opacity: n ? 1 : 0.5 }}>None</MenuPill>
      <div style={{ flex: 1 }} />
      {!phone && <Sep />}
      <AddToCollectionMenu items={items} position="bottom-end">
        <MenuPill h={h} disabled={!n} style={{ opacity: n ? 1 : 0.5, padding: phone ? '0 11px' : undefined }} aria-label="Add to collection">
          <IconFolderPlus size={15} />{!phone && <>Add to collection<span style={{ color: 'var(--il-muted)' }}>▾</span></>}
        </MenuPill>
      </AddToCollectionMenu>
      <IconBtn icon={allStarred ? <IconStarFilled size={17} /> : <IconStar size={17} />} label={allStarred ? 'Unstar selected' : 'Star selected'} on={allStarred} disabled={!n} onClick={() => favMany(items)} tone="card" size={h} />
      <IconBtn icon={<IconDownload size={17} />} label={n > 1 ? 'Download selected as a zip' : 'Download selected'} disabled={!n} onClick={() => void (n > 1 ? zipItems(items, 'imagelab-selected') : downloadMany(items))} tone="card" size={h} />
      <IconBtn icon={<IconTrash size={17} color="var(--il-err)" />} label="Delete selected" disabled={!n} onClick={() => confirmDelete(items, () => setPicked([]))} tone="card" size={h} />
      <MenuPill h={h} light onClick={() => setSelecting(false)} style={{ background: 'var(--il-fg)', color: 'var(--il-bg)', fontWeight: 800 }}>Done</MenuPill>
    </div>
  );
}
