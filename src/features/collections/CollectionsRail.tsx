import { useState } from 'react';
import { useStore } from '@/lib/store';
import { ActionIcon, Button, Divider, Group, NavLink, Text, TextInput, Tooltip } from '@mantine/core';
import { IconHeart, IconPencil, IconPhoto, IconPlus, IconUpload, IconX } from '@tabler/icons-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { RailBucket } from './useCollectionTiles';

/**
 * Left rail — three virtual buckets (`All`, `Imports`, `Favorites`) followed
 * by user-created collections. The active bucket is highlighted; clicking
 * outside the active row's chrome doesn't change selection.
 */
export function CollectionsRail({
  bucket,
  onChange,
}: {
  bucket: RailBucket;
  onChange: (next: RailBucket) => void;
}) {
  const collections = useStore((s) => s.collections);
  const history = useStore((s) => s.history);
  const importedImages = useStore((s) => s.importedImages);
  const createCollection = useStore((s) => s.createCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const confirm = useConfirm();
  const renameCollection = useStore((s) => s.renameCollection);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const totalCount = history.length + importedImages.length;
  const favCount = history.filter((h) => h.liked).length + importedImages.filter((i) => i.liked).length;

  const submitNew = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); setDraft(''); return; }
    const id = createCollection(name);
    setAdding(false);
    setDraft('');
    onChange(id);
  };
  const submitRename = (id: string) => {
    const name = renameDraft.trim();
    if (name) renameCollection(id, name);
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-panel/60 px-2 py-3">
      <RailRow
        active={bucket === 'all'}
        onClick={() => onChange('all')}
        icon={<IconPhoto size={15} />}
        label="All"
        count={totalCount}
      />
      <RailRow
        active={bucket === 'imports'}
        onClick={() => onChange('imports')}
        icon={<IconUpload size={15} />}
        label="Imports"
        count={importedImages.length}
      />
      <RailRow
        active={bucket === 'favorites'}
        onClick={() => onChange('favorites')}
        icon={<IconHeart size={15} />}
        label="Favorites"
        count={favCount}
      />

      <Divider my="xs" />

      <Text size="xs" fw={600} c="dimmed" px={4}>Collections</Text>

      {collections.map((c) => {
        const isActive = bucket === c.id;
        const isRenaming = renamingId === c.id;
        if (isRenaming) {
          return (
            <div key={c.id} className="flex items-center gap-1 px-1">
              <TextInput
                size="xs"
                value={renameDraft}
                autoFocus
                aria-label="Collection name"
                onChange={(e) => setRenameDraft(e.currentTarget.value)}
                onBlur={() => submitRename(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(c.id);
                  else if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); }
                }}
                className="min-w-0 flex-1"
              />
            </div>
          );
        }
        return (
          <div key={c.id} className="group relative">
            <NavLink
              component="button"
              type="button"
              onClick={() => onChange(c.id)}
              active={isActive}
              variant="light"
              leftSection={<span aria-hidden className="text-[12px]">{c.icon ?? '📁'}</span>}
              label={c.name}
              rightSection={<Text size="10px" c="dimmed" className="tabular-nums group-hover:invisible">{c.itemIds.length}</Text>}
              className="rounded-sm"
              classNames={{ label: 'truncate' }}
            />
            {/* Hover actions sit over the count, so the row keeps its full width for the name. */}
            <Group gap={0} wrap="nowrap" className="!absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
              <Tooltip label="Rename" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={() => { setRenamingId(c.id); setRenameDraft(c.name); }}
                  aria-label="Rename collection"
                >
                  <IconPencil size={12} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={async () => {
                    if (!await confirm(`Delete the "${c.name}" collection? The images themselves are kept.`)) return;
                    deleteCollection(c.id);
                    if (bucket === c.id) onChange('all');
                  }}
                  aria-label="Delete collection"
                >
                  <IconX size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>
        );
      })}

      {collections.length === 0 && !adding && (
        <Text size="xs" c="dimmed" fs="italic" px={4} py={4}>No collections yet.</Text>
      )}

      {adding ? (
        <div className="flex items-center gap-1 px-1">
          <TextInput
            size="xs"
            value={draft}
            autoFocus
            placeholder="Collection name…"
            aria-label="New collection name"
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={submitNew}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              else if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
            className="min-w-0 flex-1"
          />
        </div>
      ) : (
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          justify="flex-start"
          leftSection={<IconPlus size={13} />}
          onClick={() => setAdding(true)}
          mt={4}
        >
          New collection
        </Button>
      )}
    </aside>
  );
}

function RailRow({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <NavLink
      component="button"
      type="button"
      onClick={onClick}
      active={active}
      variant="light"
      leftSection={icon}
      label={label}
      rightSection={<Text size="10px" c="dimmed" className="tabular-nums">{count}</Text>}
      className="rounded-sm"
    />
  );
}
