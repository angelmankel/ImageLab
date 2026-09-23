import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Slider } from '@/components/ui/Slider';
import { COLLECTIONS_TILE_MAX, COLLECTIONS_TILE_MIN } from '@/lib/storage';
import { UploadIcon } from '@/components/ui/icons';
import type { RailBucket, Sort, Source, Tile } from './useCollectionTiles';
import { PixiCollectionsGrid } from './PixiCollectionsGrid';
import { PixiCollectionsFan } from './PixiCollectionsFan';
import { Button, Select, SegmentedControl, Stack, Text, TextInput, Group } from '@mantine/core';
import { IconLayoutGrid, IconCards, IconSearch, IconUpload, IconPhoto } from '@tabler/icons-react';

export type ViewMode = 'grid' | 'fan';

export function CollectionsGrid({
  tiles,
  bucket,
  selectedId,
  onTileClick,
  search,
  onSearchChange,
  sort,
  onSortChange,
  source,
  onSourceChange,
  viewMode,
  onViewModeChange,
  onGridColsChange,
}: {
  tiles: Tile[];
  bucket: RailBucket;
  selectedId: string | null;
  /** Click handler — the overlay decides whether this is "select" or
   *  "open fullscreen" based on whether the same tile is already selected. */
  onTileClick: (id: string) => void;
  search: string;
  onSearchChange: (next: string) => void;
  sort: Sort;
  onSortChange: (next: Sort) => void;
  source: Source;
  onSourceChange: (next: Source) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Reported up to CollectionsView so up/down arrow keys can step by row. */
  onGridColsChange?: (cols: number) => void;
}) {
  const tileSize = useStore((s) => s.collectionsTileSize);
  const setTileSize = useStore((s) => s.setCollectionsTileSize);
  const addImportedImage = useStore((s) => s.addImportedImage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);

  const importFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setImporting(true);
    try {
      for (const file of images) {
        const { width, height } = await readImageDimensions(file);
        await addImportedImage(file, { name: file.name, width, height });
      }
    } finally {
      setImporting(false);
    }
  };

  // Body-level drag handlers — capture even when the pointer enters via the
  // detail drawer or the rail. We only commit the drop if the data actually
  // includes files.
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only de-highlight when leaving the grid container — not when crossing
    // over a child element.
    if (e.currentTarget === e.target) setDragging(false);
  };
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await importFiles(files);
  };

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Toolbar
        search={search} onSearchChange={onSearchChange}
        sort={sort} onSortChange={onSortChange}
        source={source} onSourceChange={onSourceChange}
        tileSize={tileSize} onTileSizeChange={setTileSize}
        viewMode={viewMode} onViewModeChange={onViewModeChange}
        importing={importing}
        onImportClick={() => fileInputRef.current?.click()}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // allow re-import of the same file
          if (files.length) await importFiles(files);
        }}
      />

      {tiles.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
          <EmptyState bucket={bucket} search={search} onImportClick={() => fileInputRef.current?.click()} />
        </div>
      ) : viewMode === 'fan' ? (
        <PixiCollectionsFan
          tiles={tiles}
          selectedId={selectedId}
          onTileClick={onTileClick}
        />
      ) : (
        <PixiCollectionsGrid
          tiles={tiles}
          tileSize={tileSize}
          selectedId={selectedId}
          onTileClick={onTileClick}
          onColsChange={onGridColsChange}
        />
      )}

      {/* Drop overlay — only shown while a Files-bearing drag is over the
          grid. Pointer-events-none so the underlying onDrop still fires. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft/70 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-accent bg-bg-panel/95 px-6 py-4 text-center">
            <UploadIcon size={28} className="mx-auto text-accent-fg" />
            <p className="mt-2 text-[13px] font-semibold text-fg-primary">Drop to import</p>
            <p className="mt-0.5 text-[11px] text-fg-dim">PNG · JPG · WEBP — multiple files OK</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar({
  search, onSearchChange, sort, onSortChange, source, onSourceChange,
  tileSize, onTileSizeChange,
  viewMode, onViewModeChange,
  importing, onImportClick,
}: {
  search: string; onSearchChange: (s: string) => void;
  sort: Sort; onSortChange: (s: Sort) => void;
  source: Source; onSourceChange: (s: Source) => void;
  tileSize: number; onTileSizeChange: (px: number) => void;
  viewMode: ViewMode; onViewModeChange: (m: ViewMode) => void;
  importing: boolean; onImportClick: () => void;
}) {
  return (
    <Group gap="xs" wrap="nowrap" px="md" py={8} className="shrink-0 border-b border-border-subtle bg-bg-panel/60">
      <TextInput
        size="xs"
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        placeholder='Search · prefix "#" for tags only'
        aria-label="Search"
        leftSection={<IconSearch size={13} />}
        className="min-w-[180px] max-w-[260px] flex-1"
      />
      <Select
        size="xs"
        w={130}
        aria-label="Sort"
        value={sort}
        onChange={(v) => { if (v) onSortChange(v as Sort); }}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, shadow: 'md' }}
        data={[
          { value: 'newest', label: 'Newest first' },
          { value: 'oldest', label: 'Oldest first' },
          { value: 'name', label: 'By name' },
        ]}
      />
      <Select
        size="xs"
        w={130}
        aria-label="Source"
        value={source}
        onChange={(v) => { if (v) onSourceChange(v as Source); }}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, shadow: 'md' }}
        data={[
          { value: 'all', label: 'All sources' },
          { value: 'history', label: 'Generated' },
          { value: 'imports', label: 'Imported' },
        ]}
      />

      {/* Tile-size slider — grid mode only. */}
      {viewMode === 'grid' && (
        <div className="flex min-w-[140px] max-w-[220px] flex-1 items-center gap-2 px-1" title="Thumbnail size">
          <span aria-hidden className="text-[10px] text-fg-dim">A</span>
          <Slider
            value={tileSize}
            onValueChange={onTileSizeChange}
            min={COLLECTIONS_TILE_MIN}
            max={COLLECTIONS_TILE_MAX}
            step={10}
            ariaLabel="Thumbnail size"
          />
          <span aria-hidden className="text-[13px] text-fg-dim">A</span>
        </div>
      )}

      <div className="flex-1" />

      <SegmentedControl
        size="xs"
        aria-label="View mode"
        value={viewMode}
        onChange={(v) => onViewModeChange(v as ViewMode)}
        data={[
          { value: 'grid', label: <ViewLabel icon={<IconLayoutGrid size={13} />} label="Grid" /> },
          { value: 'fan', label: <ViewLabel icon={<IconCards size={13} />} label="Fan" /> },
        ]}
      />

      <Button
        size="xs"
        leftSection={<IconUpload size={13} />}
        onClick={onImportClick}
        loading={importing}
      >
        Import
      </Button>
    </Group>
  );
}

function ViewLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5" title={`${label} view`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ bucket, search, onImportClick }: { bucket: RailBucket; search: string; onImportClick: () => void }) {
  let title = 'Nothing here yet';
  let body = '';
  if (search) { title = 'No matches'; body = 'Clear the search to see everything.'; }
  else if (bucket === 'imports') body = 'Drop image files anywhere here, or click Import to add some.';
  else if (bucket === 'favorites') body = 'Heart any image to keep it pinned to Favorites.';
  else body = 'Drop image files to import, or generate something to start populating history.';

  return (
    <Stack align="center" justify="center" gap="xs" ta="center" className="h-full min-h-[300px]">
      <IconPhoto size={48} className="text-[var(--mantine-color-dimmed)] opacity-50" />
      <Text size="sm" fw={600}>{title}</Text>
      <Text size="xs" c="dimmed" maw={280}>{body}</Text>
      {bucket !== 'favorites' && (
        <Button size="xs" variant="default" leftSection={<IconUpload size={13} />} onClick={onImportClick} mt={4}>
          Import images
        </Button>
      )}
    </Stack>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
