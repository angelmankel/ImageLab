import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useBrowserStore } from './store';
import { BrowserFiltersRail, BrowserSearchInput, activeFilterCount } from './BrowserFiltersRail';
import { BrowserGrid } from './BrowserGrid';
import { OpenByIdInput } from './OpenByIdInput';
import { Badge, Button, Drawer, Stack, Text } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconBoxModel } from '@tabler/icons-react';
import { useModelMetadataStore } from '@/features/model-metadata/store';
import { BrowserModeSwitch, LibraryView, useLibraryStore } from '@/features/library';

/**
 * Model browser — a top-level view switched from the sidebar (not an overlay).
 * Fills the main area; the sidebar is the only sibling. Two columns:
 *
 *   ┌──────────┬────────────────────────────────────────┐
 *   │ filters  │ grid of CivitAI cards (hero images)    │
 *   │          │   ┌──┐ ┌──┐ ┌──┐ ┌──┐                  │
 *   │  type    │   └──┘ └──┘ └──┘ └──┘                  │
 *   │  base    │   ┌──┐ ┌──┐ …                         │
 *   │  sort    │                                        │
 *   │  period  │                                        │
 *   │  nsfw    │                                        │
 *   │  search  │                                        │
 *   └──────────┴────────────────────────────────────────┘
 *
 * On a phone the filter rail would eat the screen, so it becomes a bottom sheet behind a
 * Filters button; the search box stays in the header and the grid runs two columns.
 *
 * Clicking a card opens the existing `<ModelMetadataModal>` which already
 * does the gallery + download flow. That keeps the browser focused on
 * discovery and reuses the polished single-model surface for action.
 */
export function ModelBrowserView() {
  const filters = useBrowserStore((s) => s.filters);
  const items = useBrowserStore((s) => s.items);
  const loading = useBrowserStore((s) => s.loading);
  const loadingMore = useBrowserStore((s) => s.loadingMore);
  const nextCursor = useBrowserStore((s) => s.nextCursor);
  const error = useBrowserStore((s) => s.error);
  const refresh = useBrowserStore((s) => s.refresh);
  const loadMore = useBrowserStore((s) => s.loadMore);
  const openModel = useModelMetadataStore((s) => s.open);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mode = useLibraryStore((s) => s.browserMode);

  // First mount → kick off the initial fetch. Subsequent filter changes are
  // handled by the store's `setFilters` action so each chip click re-runs.
  const fetchedOnce = useRef(false);
  useEffect(() => {
    if (fetchedOnce.current || mode === 'library') return;
    fetchedOnce.current = true;
    void refresh();
  }, [refresh, mode]);

  // Infinite scroll: intersection observer on a sentinel after the grid. A
  // generous root margin (2500px) means the next page is requested long
  // before the user scrolls into the empty zone — by the time they reach
  // the bottom of the current page, the next batch is usually already
  // rendered. Tuned to roughly two viewports of headroom.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: '2500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [nextCursor, loadMore, items.length]);

  // Tile click → open the metadata modal. We synthesize a `browser:<id>`
  // entry id so the modal's "openEntryId" reset semantics still work.
  const onCardClick = (modelId: number) => openModel(`browser:${modelId}`, modelId);

  const headerCount = useMemo(() => {
    if (loading) return 'searching…';
    if (error) return error;
    return `${items.length}${nextCursor ? '+' : ''} model${items.length === 1 ? '' : 's'}`;
  }, [loading, error, items.length, nextCursor]);

  // "My models" replaces the whole browse layout (header included — it carries the switch back).
  if (mode === 'library') return <LibraryView narrow={narrow} />;

  const grid = (
    <BrowserGrid
      items={items}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      onRetry={refresh}
      onCardClick={onCardClick}
      showNsfw={filters.showNsfw}
      nsfwFirst={filters.catalog === 'red'}
      sentinelRef={sentinelRef}
      compact={narrow}
    />
  );

  if (narrow) {
    const active = activeFilterCount(filters);
    return (
      <div className="flex h-full w-full min-w-0 flex-col bg-bg-base">
        <header className="flex shrink-0 flex-col gap-2 border-b border-border-subtle bg-bg-panel px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrowserModeSwitch />
            <Badge size="sm" variant="light" color="gray" tt="none" className="min-w-0">{headerCount}</Badge>
            <Button ml="auto" size="xs" variant={active ? 'light' : 'default'} className="shrink-0"
              leftSection={<IconAdjustmentsHorizontal size={14} />} onClick={() => setFiltersOpen(true)}>
              Filters{active ? ` · ${active}` : ''}
            </Button>
          </div>
          <BrowserSearchInput size="sm" />
        </header>
        <div className="flex min-h-0 flex-1">{grid}</div>
        <Drawer opened={filtersOpen} onClose={() => setFiltersOpen(false)} position="bottom" size="85%" title="Filters"
          styles={{ content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}>
          <BrowserFiltersRail filters={filters} sheet footer={
            <Stack gap={6}>
              <Text size="xs" fw={600} c="dimmed">Open by id</Text>
              <OpenByIdInput fullWidth />
              <Button mt="sm" fullWidth onClick={() => setFiltersOpen(false)}>Show {headerCount}</Button>
            </Stack>
          } />
        </Drawer>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-bg-base">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-panel px-3 py-2">
        <IconBoxModel size={16} className="text-[var(--mantine-color-dimmed)]" />
        <BrowserModeSwitch />
        <Badge size="sm" variant="light" color="gray" tt="none" className="shrink-0">
          {headerCount}
        </Badge>
        <div className="ml-auto"><OpenByIdInput /></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <BrowserFiltersRail filters={filters} />
        {grid}
      </div>
    </div>
  );
}
