import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ActionIcon, Badge, Chip, Group, SimpleGrid, Slider, Stack, Text, Tooltip } from '@mantine/core';
import { IconHistory, IconLayoutGrid, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfy';
import type { HistoryEntry } from '@/lib/types';
import { FullscreenViewer, useLiveFrame } from './FullscreenViewer';
import { useViewerPrefs } from './viewerPrefs';
import { HistoryGridItem } from './HistoryGridItem';
import { JobQueue } from './JobQueue';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';

const COLUMNS_KEY = 'imagelab.historyColumns.v1';
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

function loadColumns(): number {
  try {
    const n = Number(localStorage.getItem(COLUMNS_KEY));
    if (n >= MIN_COLUMNS && n <= MAX_COLUMNS) return n;
  } catch { /* ignore */ }
  return 2;
}

export interface HistoryPanelProps {
  /**
   * Tile click behavior. `'select-then-open'` (default) requires a second
   * click on an already-selected tile to open the fullscreen viewer — the
   * generate view uses this so the first click just updates the selection.
   * `'open-immediately'` opens the viewer on the first click — canvas view
   * uses this since the canvas compositor doesn't react to selection.
   */
  tileClickMode?: 'select-then-open' | 'open-immediately';
}

/**
 * History is one unified list now — the server that generated an image is just
 * metadata (`entry.serverId`). The chip row ("All" + one per server) filters on
 * that metadata; like/delete go straight through the store.
 *
 * Laid out as v1's OutputPanel: a slim controls bar (grid-size slider, filters,
 * bulk delete), the running-job strip, then a square-tile grid.
 */
export function HistoryPanel({ tileClickMode = 'select-then-open' }: HistoryPanelProps = {}) {
  // In 'open-immediately' mode the panel doesn't write to the global
  // `selectedEntry` — that selection drives the generate-view canvas
  // (StrippedCanvas), and bleeding canvas-view clicks into it would make the
  // two views feel synced. Track the active tile locally instead so the
  // fullscreen viewer + arrow keys still have a cursor.
  const isolateSelection = tileClickMode === 'open-immediately';
  const history = useStore(s => s.history);
  const servers = useStore(s => s.servers);
  const globalSelectedEntry = useStore(s => s.selectedEntry);
  const selectHistoryEntry = useStore(s => s.selectHistoryEntry);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedId = isolateSelection
    ? localSelectedId
    : (globalSelectedEntry?.id ?? null);
  const toggleHistoryLiked = useStore(s => s.toggleHistoryLiked);
  const removeHistoryEntry = useStore(s => s.removeHistoryEntry);
  const clearUnliked = useStore(s => s.clearUnliked);
  const confirm = useConfirm();
  const viewerOpen = useStore(s => s.viewerOpen);
  // The viewer can open on a live frame before anything has finished.
  const liveFrame = useLiveFrame();
  const livePref = useViewerPrefs(s => s.livePreview);
  const hasLiveFrame = !!liveFrame && livePref;
  const openViewer = useStore(s => s.openViewer);
  const closeViewer = useStore(s => s.closeViewer);

  // Tab is a server id, or 'all'.
  const [tab, setTab] = useState<string>('all');
  const [likedOnly, setLikedOnly] = useState(false);
  const [sizes, setSizes] = useState<Record<string, [number, number]>>({});
  const [columns, setColumnsState] = useState(loadColumns);
  const setColumns = (n: number) => {
    setColumnsState(n);
    try { localStorage.setItem(COLUMNS_KEY, String(n)); } catch { /* ignore */ }
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  const hostFor = useCallback(
    (e: HistoryEntry) => servers.find(s => s.id === e.serverId)?.host ?? '',
    [servers],
  );
  const serverName = useCallback(
    (id: string) => servers.find(s => s.id === id)?.name ?? 'Unknown server',
    [servers],
  );

  const list = useMemo(() => {
    let arr = tab === 'all' ? history : history.filter(h => h.serverId === tab);
    if (likedOnly) arr = arr.filter(h => h.liked);
    return arr;
  }, [tab, history, likedOnly]);

  // Shared by click + arrow keys. In generate mode this writes to global
  // selection (StrippedCanvas reads `selectedEntry` directly); in canvas mode
  // it only updates the panel-local cursor.
  const selectEntry = useCallback((entry: HistoryEntry) => {
    if (isolateSelection) setLocalSelectedId(entry.id);
    else selectHistoryEntry(entry);
  }, [isolateSelection, selectHistoryEntry]);

  // ←/→ step through the current list. Panel priority — the fullscreen
  // viewer registers at TopOverlay so its arrows take precedence when open;
  // the metadata gallery overlay uses Overlay priority, also higher than
  // this panel-level binding.
  const arrowHandler = (dir: -1 | 1) => {
    if (list.length === 0) return;
    const cur = list.findIndex(h => h.id === selectedId);
    const nextIdx = cur < 0
      ? 0
      : dir === -1 ? Math.max(0, cur - 1) : Math.min(list.length - 1, cur + 1);
    const next = list[nextIdx];
    if (next && next.id !== selectedId) selectEntry(next);
  };
  useShortcut('ArrowLeft',  () => arrowHandler(-1), { priority: ShortcutPriority.Panel, when: () => !viewerOpen });
  useShortcut('ArrowRight', () => arrowHandler(1),  { priority: ShortcutPriority.Panel, when: () => !viewerOpen });

  // Keep the selected thumbnail scrolled into view (click or arrow selection).
  // Guard: when the panel is collapsed it's translated off-screen but still in
  // the DOM, and `scrollIntoView` will walk scroll ancestors trying to reveal
  // the tile — which scrolls the app shell sideways and "half-opens" the
  // panel. Skip when our own scroll container isn't on-screen, and constrain
  // the scroll to that container by computing the offset manually instead of
  // letting `scrollIntoView` propagate upward.
  useEffect(() => {
    if (!selectedId) return;
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onScreen =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth;
    if (!onScreen) return;
    const tile = container.querySelector<HTMLElement>(`[data-history-id="${selectedId}"]`);
    if (!tile) return;
    const tileRect = tile.getBoundingClientRect();
    const above = tileRect.top < rect.top;
    const below = tileRect.bottom > rect.bottom;
    if (!above && !below) return;
    const delta = above ? tileRect.top - rect.top : tileRect.bottom - rect.bottom;
    container.scrollBy({ top: delta, behavior: 'smooth' });
  }, [selectedId, list]);

  const unlikedCount = history.filter(h => !h.liked).length;
  const onClearUnliked = async () => {
    if (unlikedCount === 0) return;
    const noun = unlikedCount === 1 ? 'image' : 'images';
    if (await confirm(`Delete ${unlikedCount} non-favorited ${noun}? Liked images are kept.`)) {
      clearUnliked();
    }
  };

  const deleteEntry = async (entry: HistoryEntry) => {
    const ok = await confirm({
      message: 'Delete this image?',
      confirmLabel: 'Delete',
      dontAskAgainKey: 'history.deleteEntry',
    });
    if (ok) removeHistoryEntry(entry.id);
  };
  const viewerIndex = viewerOpen ? Math.max(0, list.findIndex(e => e.id === selectedId)) : -1;

  return (
    <Stack component="aside" h="100%" gap={0}>
      {/* Controls bar */}
      <Group justify="space-between" gap="xs" wrap="nowrap" px="xs" py={6} style={{ borderBottom: '1px solid var(--mantine-color-dark-4)', flexShrink: 0 }}>
        <Group gap={6} wrap="nowrap">
          <IconHistory size={14} style={{ opacity: 0.6 }} />
          <Text size="sm" fw={600}>History</Text>
          <Badge size="xs" variant="light" color="gray">{list.length}</Badge>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Tooltip label="Grid size" withinPortal fz="xs">
            <Group gap={6} wrap="nowrap">
              <IconLayoutGrid size={14} style={{ opacity: 0.5 }} />
              <Slider
                aria-label="Grid columns"
                value={columns}
                onChange={setColumns}
                min={MIN_COLUMNS}
                max={MAX_COLUMNS}
                step={1}
                size="xs"
                label={null}
                w={64}
                styles={{ thumb: { display: 'none' } }}
              />
            </Group>
          </Tooltip>
          <Tooltip label="Show favorites only" withinPortal fz="xs">
            <ActionIcon
              variant={likedOnly ? 'light' : 'subtle'}
              color={likedOnly ? 'yellow' : 'gray'}
              size="sm"
              aria-label="Show favorites only"
              aria-pressed={likedOnly}
              onClick={() => setLikedOnly(v => !v)}
            >
              {likedOnly ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={unlikedCount === 0
              ? 'No non-favorited images'
              : `Delete ${unlikedCount} non-favorite image${unlikedCount === 1 ? '' : 's'}`}
            withinPortal
            fz="xs"
          >
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label="Delete non-favorited images"
              onClick={onClearUnliked}
              disabled={unlikedCount === 0}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Server filter chips */}
      {servers.length > 0 && (
        <Chip.Group multiple={false} value={tab} onChange={setTab}>
          <Group gap={4} wrap="nowrap" px="xs" py={6} style={{ overflowX: 'auto', flexShrink: 0 }}>
            <Chip value="all" size="xs" radius="sm">All</Chip>
            {servers.map(sv => (
              <Chip key={sv.id} value={sv.id} size="xs" radius="sm">{sv.name}</Chip>
            ))}
          </Group>
        </Chip.Group>
      )}

      <JobQueue />

      <div ref={scrollRef} className="scroll-y min-h-0 flex-1" style={{ padding: 8 }}>
        {list.length === 0 ? (
          <Stack align="center" justify="center" gap="xs" py="xl">
            <IconHistory size={32} style={{ opacity: 0.3 }} />
            <Text size="sm" c="dimmed" ta="center">
              {likedOnly ? 'No favorited images here' : 'No outputs yet'}
            </Text>
            {!likedOnly && (
              <Text size="xs" c="dimmed" ta="center">Generated images will appear here</Text>
            )}
          </Stack>
        ) : (
          <SimpleGrid cols={columns} spacing={4} verticalSpacing={4}>
            {list.map(entry => {
              const url = viewUrl(entry, hostFor(entry));
              return (
                <HistoryGridItem
                  key={entry.id}
                  id={entry.id}
                  url={url}
                  filename={entry.filename}
                  label={entry.positive || 'history image'}
                  liked={!!entry.liked}
                  selected={entry.id === selectedId}
                  serverLabel={tab === 'all' ? serverName(entry.serverId) : null}
                  size={sizes[entry.id]}
                  onSelect={() => {
                    if (tileClickMode === 'open-immediately') {
                      selectEntry(entry);
                      openViewer();
                      return;
                    }
                    if (entry.id === selectedId) { openViewer(); return; }
                    selectEntry(entry);
                  }}
                  onInfo={() => { selectEntry(entry); openViewer({ withInfo: true }); }}
                  onToggleLiked={() => toggleHistoryLiked(entry.id)}
                  onDelete={() => { void deleteEntry(entry); }}
                  onNaturalSize={(w, h) => setSizes(prev =>
                    prev[entry.id]?.[0] === w && prev[entry.id]?.[1] === h
                      ? prev
                      : { ...prev, [entry.id]: [w, h] }
                  )}
                />
              );
            })}
          </SimpleGrid>
        )}
      </div>

      {viewerOpen && (list.length > 0 || hasLiveFrame) && (
        <FullscreenViewer
          list={list}
          index={Math.max(0, viewerIndex)}
          onIndexChange={(i) => { const next = list[i]; if (next) selectEntry(next); }}
          onClose={closeViewer}
        />
      )}
    </Stack>
  );
}
