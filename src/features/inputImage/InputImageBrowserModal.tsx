/**
 * InputImageBrowserModal (v1)
 * ===========================
 * Pick an input image from what this app has already generated. v1 browsed server-side uploaded
 * assets; this app has no asset store, so the grid is the generation history instead — the same
 * images the History panel shows, searchable by prompt or filename, with the liked filter.
 */
import { useMemo, useState } from 'react';
import {
  ActionIcon, Box, Center, Group, Image, Modal, ScrollArea, SimpleGrid, Text, TextInput, Tooltip,
} from '@mantine/core';
import { IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfy';
import type { HistoryEntry } from '@/lib/types';

const FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23666' font-size='12'%3ENo preview%3C/text%3E%3C/svg%3E";

export function InputImageBrowserModal({ opened, onClose, onSelect }: {
  opened: boolean;
  onClose: () => void;
  onSelect: (url: string, name: string) => void;
}) {
  const history = useStore(s => s.history);
  const servers = useStore(s => s.servers);
  const toggleHistoryLiked = useStore(s => s.toggleHistoryLiked);
  const [search, setSearch] = useState('');
  const [likedOnly, setLikedOnly] = useState(false);

  const hostFor = (e: HistoryEntry) => servers.find(s => s.id === e.serverId)?.host ?? '';
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(h => (!likedOnly || h.liked)
      && (!q || h.filename.toLowerCase().includes(q) || h.positive.toLowerCase().includes(q)));
  }, [history, search, likedOnly]);

  return (
    <Modal opened={opened} onClose={onClose} title="Select Input Image" size="lg" centered>
      <Group gap="xs" mb="md">
        <TextInput
          placeholder="Search images..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
          aria-label="Search images"
        />
        <Tooltip label={likedOnly ? 'Show all' : 'Liked only'}>
          <ActionIcon variant={likedOnly ? 'filled' : 'light'} color={likedOnly ? 'yellow' : undefined} size="lg"
            onClick={() => setLikedOnly(!likedOnly)} aria-pressed={likedOnly} aria-label="Show liked images only">
            {likedOnly ? <IconStarFilled size={16} /> : <IconStar size={16} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea.Autosize scrollbars="y" mah="min(400px, 55vh)">
        {filtered.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">{search || likedOnly ? 'No images match your search' : 'No generations yet'}</Text>
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="sm">
            {filtered.map((entry) => {
              const url = viewUrl(entry, hostFor(entry));
              return (
                <Box
                  key={entry.id}
                  component="button"
                  type="button"
                  onClick={() => onSelect(url, entry.filename)}
                  aria-label={`Use ${entry.filename} as the input image`}
                  className="relative cursor-pointer overflow-hidden rounded-md border-2 border-transparent bg-bg-input p-0 transition-colors hover:border-accent"
                >
                  <Image src={url} alt={entry.filename} h={160} fit="contain" fallbackSrc={FALLBACK} loading="lazy" />
                  <ActionIcon
                    component="span"
                    size="sm"
                    variant="filled"
                    color={entry.liked ? 'yellow' : 'dark'}
                    onClick={(e) => { e.stopPropagation(); toggleHistoryLiked(entry.id); }}
                    aria-label={entry.liked ? 'Unlike' : 'Like'}
                    style={{ position: 'absolute', top: 4, right: 4 }}
                  >
                    {entry.liked ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                  </ActionIcon>
                  <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', textAlign: 'left' }}>
                    <Text size="xs" c="white" truncate>{entry.filename}</Text>
                    <Text size="xs" c="dimmed">{new Date(entry.createdAt).toLocaleDateString()}</Text>
                  </Box>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </ScrollArea.Autosize>

      <Text size="xs" c="dimmed" ta="center" mt="md">
        {filtered.length} image{filtered.length !== 1 ? 's' : ''} {search && `matching "${search}"`}
      </Text>
    </Modal>
  );
}
