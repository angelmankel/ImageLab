import { forwardRef, useState, useEffect, useMemo, useRef } from 'react';
import { useCollapsed } from '@/hooks/useCollapsed';
import { canvasStorage } from '@/lib/canvasStorageInstance';
import { getCanvasController } from '@/lib/canvasContext';
import { blobToDisplayUrl } from '@/lib/brush/pibr';
import type { LayerHistoryEntry } from '@/lib/types';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon, Badge, Box, Button, Group, Menu, Paper, SegmentedControl, Select, Text, TextInput,
  Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconCamera, IconChevronDown, IconChevronRight, IconCopy, IconEraser, IconEye, IconEyeOff,
  IconFolder, IconFolderOpen, IconFolderPlus, IconGripVertical, IconLock, IconLockOpen, IconPhoto,
  IconPlus, IconX,
} from '@tabler/icons-react';
import type { CanvasLayer } from '@/lib/types';
import { useCanvasStore } from '@/lib/canvasStore';
import { RESOLUTION_PRESETS } from '@/lib/storage';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { InpaintSection } from '@/features/inputImage';
import { cn } from '@/lib/cn';
import { useLayerSelectedThumb } from '@/hooks/useLayerSelectedThumb';
import { snapshotLayerComposite } from './snapshotLayer';

// Most-recently-used layer ids to surface as "Recents" in the add-layer
// popover (#41 follow-up). Module-local because it never needs to survive
// reloads — the source list is sorted by zIndex anyway, recents are just a
// soft pin within a single session.
const recentSourceIds: string[] = [];
function bumpRecent(id: string) {
  const idx = recentSourceIds.indexOf(id);
  if (idx >= 0) recentSourceIds.splice(idx, 1);
  recentSourceIds.unshift(id);
  while (recentSourceIds.length > 2) recentSourceIds.pop();
}

/**
 * Right-panel "Layers" tab — Photoshop-style list of canvas-compositor layers.
 *
 * Index mapping note: `canvasStore.canvasLayers` is sorted ascending by
 * `zIndex` (top of the stack = LAST element). We render the panel reversed so
 * the visually-top row is the highest-zIndex layer. Whenever we hand indexes
 * back to `reorderCanvasLayers`, we convert from display-index (top=0) to
 * store-index via `storeIdx = layers.length - 1 - displayIdx`.
 */
export function CanvasLayersPanel() {
  const layers = useCanvasStore(s => s.canvasLayers);
  const activeId = useCanvasStore(s => s.activeLayerId);
  const hydrated = useCanvasStore(s => s.canvasLayersHydrated);
  const addCanvasLayer = useCanvasStore(s => s.addCanvasLayer);
  const reorderCanvasLayers = useCanvasStore(s => s.reorderCanvasLayers);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Build a tree: top-level entries (sorted highest-zIndex first), with
  // folder children rendered nested. Children also sort by zIndex desc.
  // Display list (flat, for SortableContext) still needs every id so dnd-kit
  // can match drop targets.
  const setLayerParent = useCanvasStore(s => s.setLayerParent);
  const addCanvasFolder = useCanvasStore(s => s.addCanvasFolder);
  type Tree = { layer: CanvasLayer; children: CanvasLayer[] }[];
  const tree: Tree = useMemo(() => {
    const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);
    const topLevel = sorted.filter(l => !l.parentId);
    return topLevel.map(l => ({
      layer: l,
      children: l.isFolder
        ? sorted.filter(c => c.parentId === l.id)
        : [],
    }));
  }, [layers]);
  const flatIds = useMemo(() => {
    const out: string[] = [];
    for (const node of tree) {
      out.push(node.layer.id);
      for (const child of node.children) out.push(child.id);
    }
    return out;
  }, [tree]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);

    // Drop-into-folder zone uses id "folder-zone:<folderId>".
    if (overId.startsWith('folder-zone:')) {
      const folderId = overId.slice('folder-zone:'.length);
      setLayerParent(activeId, folderId);
      return;
    }
    // Drop into the top-level root zone.
    if (overId === 'root-zone') {
      setLayerParent(activeId, null);
      return;
    }

    // Sort-style drop on another layer: reuse existing reorder. If the over
    // target sits in a different parent, re-parent first.
    const activeLayer = layers.find(l => l.id === activeId);
    const overLayer = layers.find(l => l.id === overId);
    if (!activeLayer || !overLayer) return;
    if (activeLayer.isFolder) {
      // Folders can only re-order at the root level. No drop into other folders.
      if (overLayer.parentId) return;
    } else if (activeLayer.parentId !== overLayer.parentId) {
      setLayerParent(activeId, overLayer.parentId ?? null);
    }
    // Reorder by store-index (ascending zIndex). Convert from flat display id.
    const fromStore = layers.findIndex(l => l.id === activeId);
    const toStore = layers.findIndex(l => l.id === overId);
    if (fromStore < 0 || toStore < 0) return;
    reorderCanvasLayers(fromStore, toStore);
  };

  const addCanvasLayerFromSource = useCanvasStore(s => s.addCanvasLayerFromSource);
  const handleAdd = (sourceId?: string) => {
    if (sourceId) {
      const id = addCanvasLayerFromSource(sourceId);
      if (id) bumpRecent(sourceId);
    } else {
      addCanvasLayer({});
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      {/* Wraps onto a second row when the docked panel is too narrow for one. */}
      <Group
        gap="xs"
        style={{ rowGap: 6 }}
        px="sm"
        py={10}
        className="shrink-0 border-b border-border-subtle bg-bg-panel"
      >
        <Text size="sm" fw={600}>Layers</Text>
        <Badge size="sm" variant="light" color="gray" className="shrink-0">
          {layers.length}
        </Badge>
        <Group gap={6} ml="auto" wrap="nowrap">
          <DefaultSizePicker />
          <Tooltip label="Add a group/folder" withArrow>
            <ActionIcon variant="default" size={30} onClick={() => addCanvasFolder()} aria-label="Add a group">
              <IconFolderPlus size={15} />
            </ActionIcon>
          </Tooltip>
          <AddLayerButton onAdd={handleAdd} />
        </Group>
      </Group>

      {/* Scrollable body — SelectedLayerSection is inside the scroll container
          (not above it) so its inpaint knobs don't squeeze the layer list off
          the bottom on short viewports. The whole panel scrolls as one. */}
      <div className="scroll-y min-h-0 flex-1 overflow-x-hidden">
        <SelectedLayerSection />
        <div className="px-2 py-2">
        {!hydrated ? (
          <Text size="xs" c="dimmed" fs="italic" ta="center" px="sm" py="xl">
            Loading layers…
          </Text>
        ) : layers.length === 0 ? (
          <Paper withBorder radius="md" px="sm" py="xl" className="flex flex-col items-center gap-3 !border-dashed text-center">
            <Text size="sm" c="dimmed">No canvas layers yet</Text>
            <AddLayerButton onAdd={handleAdd} prominent />
          </Paper>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {tree.map(node => (
                  node.layer.isFolder
                    ? <FolderRow key={node.layer.id} layer={node.layer} children={node.children} activeId={activeId} />
                    : <LayerRow key={node.layer.id} layer={node.layer} active={node.layer.id === activeId} />
                ))}
                <RootDropZone />
              </div>
            </SortableContext>
          </DndContext>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Selected-layer section ──────────────────────────────────────────────────
// Inpaint/fill-mode controls + layer utilities for the currently-active
// layer. Per-layer generation parameters (prompt, denoise, seed, …) live in
// the left panel and are intentionally NOT duplicated here — this section
// is scoped to layer-level functions like fill mode and future utilities
// (Remove BG, etc.).

function SelectedLayerSection() {
  const activeId = useCanvasStore(s => s.activeLayerId);
  const layer = useCanvasStore(s =>
    s.activeLayerId ? s.canvasLayers.find(l => l.id === s.activeLayerId) ?? null : null);
  const updateCanvasLayer = useCanvasStore(s => s.updateCanvasLayer);

  if (!activeId || !layer) {
    return (
      <Box px="sm" py="sm" className="shrink-0 border-b border-border-subtle bg-bg-panel">
        <Text size="xs" fw={600} c="dimmed">Selected layer</Text>
        <Text size="xs" c="dimmed" fs="italic" mt={6}>
          Select a layer to edit its mode and actions.
        </Text>
      </Box>
    );
  }

  const fillMode = layer.fillMode ?? 'inpaint';
  const hasSelection = !!layer.selectedHistoryId;
  const modes: { value: 'inpaint' | 'img2img' | 'txt2img'; label: string; hint: string; disabled?: boolean }[] = [
    { value: 'txt2img', label: 'Txt2img', hint: 'Skip canvas capture — generate a fresh image at the layer’s bounds size.' },
    { value: 'img2img', label: 'Img2img', hint: hasSelection
        ? 'Use the layer’s selected history image as the source. No mask.'
        : 'Select a history image first to enable img2img.',
      disabled: !hasSelection },
    { value: 'inpaint', label: 'Inpaint', hint: 'Capture the canvas + bounds mask and run through the inpaint pipeline.' },
  ];

  return (
    <Box px="sm" py="sm" className="shrink-0 border-b border-border-subtle bg-bg-panel">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={600} c="dimmed" className="shrink-0">Selected layer</Text>
        <Text size="xs" c="dimmed" truncate title={layer.name}>{layer.name}</Text>
      </Group>

      <Group gap="xs" mt="xs" wrap="nowrap">
        <Text size="xs" className="shrink-0">Fill mode</Text>
        <SegmentedControl
          size="xs"
          fullWidth
          className="flex-1"
          aria-label="Fill mode"
          value={fillMode}
          onChange={(v) => updateCanvasLayer(layer.id, { fillMode: v as typeof fillMode })}
          data={modes.map(m => ({
            value: m.value,
            disabled: m.disabled,
            label: <span title={m.hint} aria-pressed={fillMode === m.value}>{m.label}</span>,
          }))}
        />
      </Group>

      {fillMode === 'inpaint' && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <InpaintSection />
        </div>
      )}
    </Box>
  );
}

// ── Add-layer button ────────────────────────────────────────────────────────

/**
 * Add-layer button. Clicking the primary face adds a fresh layer (inheriting
 * params from the most-recently-active layer). Clicking the chevron opens a
 * popover that lets the user explicitly pick a source layer to copy params
 * from, with up to two "Recents" pinned at the top.
 */
function AddLayerButton({
  onAdd,
  prominent,
}: {
  onAdd: (sourceId?: string) => void;
  prominent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allLayers = useCanvasStore(s => s.canvasLayers);
  const lastActiveId = useCanvasStore(s => s.lastActiveLayerId);
  const sorted = useMemo(
    () => [...allLayers].sort((a, b) => b.zIndex - a.zIndex),
    [allLayers],
  );
  const recentIds = useMemo(() => {
    const out: string[] = [];
    for (const id of recentSourceIds) {
      if (out.length >= 2) break;
      if (allLayers.some(l => l.id === id)) out.push(id);
    }
    if (out.length < 2 && lastActiveId && !out.includes(lastActiveId)
        && allLayers.some(l => l.id === lastActiveId)) {
      out.push(lastActiveId);
    }
    return out;
  }, [allLayers, lastActiveId]);
  const recents = recentIds
    .map(id => allLayers.find(l => l.id === id))
    .filter((l): l is CanvasLayer => !!l);

  const variant = prominent ? 'filled' : 'default';

  return (
    <Button.Group>
      <Button
        size="xs"
        variant={variant}
        leftSection={<IconPlus size={14} />}
        onClick={() => onAdd()}
        title="Add a fresh canvas layer (inherits last layer's params)"
      >
        Add layer
      </Button>
      {sorted.length > 0 && (
        <Menu opened={open} onChange={setOpen} position="bottom-end" width={240} shadow="md" withinPortal>
          <Menu.Target>
            <Button
              size="xs"
              px={6}
              variant={variant}
              title="Copy params from an existing layer"
              aria-label="Copy params from an existing layer"
            >
              <IconChevronDown size={12} />
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>New layer from…</Menu.Label>
            <div className="scroll-y max-h-[320px]">
              <Menu.Item
                leftSection={<IconPlus size={12} />}
                rightSection={<Text size="10px" c="dimmed">last active</Text>}
                onClick={() => onAdd()}
              >
                Blank layer
              </Menu.Item>
              {recents.length > 0 && (
                <>
                  <Menu.Label>Recents</Menu.Label>
                  {recents.map(l => (
                    <SourceRow key={`r-${l.id}`} layer={l} onPick={(id) => onAdd(id)} />
                  ))}
                  <Menu.Divider />
                </>
              )}
              <Menu.Label>All layers</Menu.Label>
              {sorted.map(l => (
                <SourceRow key={l.id} layer={l} onPick={(id) => onAdd(id)} />
              ))}
            </div>
          </Menu.Dropdown>
        </Menu>
      )}
    </Button.Group>
  );
}

function SourceRow({ layer, onPick }: { layer: CanvasLayer; onPick: (id: string) => void }) {
  return (
    <Menu.Item
      onClick={() => onPick(layer.id)}
      leftSection={<Text size="10px" c="dimmed" ff="monospace">z{layer.zIndex}</Text>}
    >
      <Text size="sm" truncate>{layer.name}</Text>
    </Menu.Item>
  );
}

// ── Per-layer row ────────────────────────────────────────────────────────────

function LayerRow({ layer, active }: { layer: CanvasLayer; active: boolean }) {
  const setActiveLayer = useCanvasStore(s => s.setActiveLayer);
  const updateCanvasLayer = useCanvasStore(s => s.updateCanvasLayer);
  const removeCanvasLayer = useCanvasStore(s => s.removeCanvasLayer);
  const confirm = useConfirm();
  // `useCollapsed` returns `collapsed` (true = hidden). We flip naming locally.
  const [historyCollapsed, toggleHistory] = useCollapsed(`canvasLayer.history:${layer.id}`, true);
  const historyOpen = !historyCollapsed;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Inline name editing. Draft starts in sync with the store; commits on blur
  // or Enter, reverts on Escape. Effect resyncs if the store-side name changes
  // out from under us (e.g. layer rebuild).
  const [nameDraft, setNameDraft] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setNameDraft(layer.name), [layer.name]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(layer.name);
      return;
    }
    if (trimmed !== layer.name) updateCanvasLayer(layer.id, { name: trimmed });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete layer',
      message: `Delete “${layer.name}”? Its per-layer history will also be removed.`,
      confirmLabel: 'Delete',
    });
    if (ok) removeCanvasLayer(layer.id);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
    <Paper
      withBorder
      radius="md"
      px={8}
      py={8}
      className="flex flex-col gap-2 border-l-[3px] transition-colors"
      style={active
        ? { borderColor: 'var(--mantine-primary-color-filled)', backgroundColor: 'var(--mantine-primary-color-light)' }
        : { borderLeftColor: 'transparent' }}
    >
      {/* Row 1: identity — disclosure, drag, thumbnail, name (full width), z-chip. */}
      <Group gap={6} wrap="nowrap">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={(e) => { e.stopPropagation(); toggleHistory(); }}
          title={historyOpen ? 'Collapse history' : 'Expand history'}
          aria-label={historyOpen ? 'Collapse history' : 'Expand history'}
          aria-expanded={historyOpen}
        >
          {historyOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
        <DragHandle label="Drag to reorder" attributes={attributes} listeners={listeners} />

        <LayerThumb layer={layer} onClick={() => setActiveLayer(layer.id)} />

        {/* Name field — takes all remaining row space. Activates the layer on plain click. */}
        <NameInput
          ref={inputRef}
          value={nameDraft}
          onChange={setNameDraft}
          onBlur={commitName}
          onFocus={() => setActiveLayer(layer.id)}
          onEnter={(el) => el.blur()}
          onEscape={(el) => { setNameDraft(layer.name); el.blur(); }}
          onClick={(e) => { e.stopPropagation(); setActiveLayer(layer.id); }}
        />

        <Tooltip label="z-index (higher renders on top)" withArrow>
          <Badge size="xs" variant="default" radius="sm" ff="monospace" tt="none" className="shrink-0">
            z{layer.zIndex}
          </Badge>
        </Tooltip>
      </Group>

      {/* Row 2: action buttons — compact, evenly distributed across the row. */}
      <Group gap={4} wrap="nowrap" pl={28}>
        <CopyParamsButton targetLayerId={layer.id} />
        <RowBtn
          title="Capture the visible canvas at this layer's bounds as a new history entry"
          onClick={() => { void snapshotLayerComposite(layer.id); }}
        >
          <IconCamera size={14} />
        </RowBtn>
        <RowBtn
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={() => updateCanvasLayer(layer.id, { visible: !layer.visible })}
          dim={!layer.visible}
        >
          {layer.visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
        </RowBtn>
        <RowBtn
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={() => updateCanvasLayer(layer.id, { locked: !layer.locked })}
          on={!!layer.locked}
          dim={!layer.locked}
        >
          {layer.locked ? <IconLock size={14} /> : <IconLockOpen size={14} />}
        </RowBtn>
        {layer.selectedHistoryId && (
          <RowBtn
            title="Clear stamp (unselects the current image, layer + its history are kept)"
            onClick={() => updateCanvasLayer(layer.id, { selectedHistoryId: undefined })}
            dim
          >
            <IconEraser size={14} />
          </RowBtn>
        )}
        <RowBtn title="Delete layer" danger onClick={handleDelete}>
          <IconX size={14} />
        </RowBtn>
      </Group>
    </Paper>

    {historyOpen && <LayerHistoryList layer={layer} />}
    </div>
  );
}

function FolderRow({
  layer, children, activeId,
}: {
  layer: CanvasLayer;
  children: CanvasLayer[];
  activeId: string | null;
}) {
  const toggleFolderCollapsed = useCanvasStore(s => s.toggleFolderCollapsed);
  const removeCanvasLayer = useCanvasStore(s => s.removeCanvasLayer);
  const updateCanvasLayer = useCanvasStore(s => s.updateCanvasLayer);
  const confirm = useConfirm();
  const open = !layer.folderCollapsed;
  const [nameDraft, setNameDraft] = useState(layer.name);
  useEffect(() => setNameDraft(layer.name), [layer.name]);
  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setNameDraft(layer.name); return; }
    if (trimmed !== layer.name) updateCanvasLayer(layer.id, { name: trimmed });
  };

  // The folder row itself is sortable (you can reorder folders).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // The body is a drop target for "drop into folder" — id "folder-zone:<id>".
  const { setNodeRef: setZoneRef, isOver } = useDroppable({ id: `folder-zone:${layer.id}` });

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete group',
      message: `Delete the “${layer.name}” group? Layers inside will become un-grouped, not deleted.`,
      confirmLabel: 'Delete group',
    });
    if (ok) removeCanvasLayer(layer.id);
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <Group
        gap={6}
        wrap="nowrap"
        px={8}
        py={6}
        className={cn(
          'rounded-t-md border border-b-0 transition-colors',
          !open && 'rounded-b-md border-b',
        )}
        style={isOver
          ? { borderColor: 'var(--mantine-primary-color-filled)', backgroundColor: 'var(--mantine-primary-color-light)' }
          : { borderColor: 'var(--mantine-color-dark-4)', backgroundColor: 'var(--mantine-color-dark-5)' }}
      >
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => toggleFolderCollapsed(layer.id)}
          title={open ? 'Collapse group' : 'Expand group'}
          aria-label={open ? 'Collapse group' : 'Expand group'}
        >
          {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        </ActionIcon>
        <DragHandle label="Drag to reorder group" attributes={attributes} listeners={listeners} />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--mantine-color-dimmed)]">
          {open ? <IconFolderOpen size={16} /> : <IconFolder size={16} />}
        </span>
        <NameInput
          value={nameDraft}
          onChange={setNameDraft}
          onBlur={commitName}
          onEnter={(el) => el.blur()}
          onEscape={(el) => { setNameDraft(layer.name); el.blur(); }}
          bold
        />
        <Badge size="xs" variant="default" radius="sm" ff="monospace" className="shrink-0">
          {children.length}
        </Badge>
        <Tooltip label="Delete group" withArrow>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={handleDelete} aria-label="Delete group">
            <IconX size={13} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {open && (
        <div
          ref={setZoneRef}
          className="flex flex-col gap-1.5 rounded-b-md border border-t-0 px-2 pb-2 pt-1.5"
          style={isOver
            ? { borderColor: 'var(--mantine-primary-color-filled)', backgroundColor: 'var(--mantine-primary-color-light)' }
            : { borderColor: 'var(--mantine-color-dark-4)', backgroundColor: 'var(--mantine-color-dark-7)' }}
        >
          {children.length === 0 ? (
            <Text size="xs" c="dimmed" fs="italic" ta="center" py={8}>
              Drop layers here
            </Text>
          ) : (
            children.map(c => (
              <LayerRow key={c.id} layer={c} active={c.id === activeId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'root-zone' });
  return (
    <div
      ref={setNodeRef}
      className="mt-1 h-6 rounded-sm border border-dashed text-center text-[10px] leading-6 transition-colors"
      style={isOver
        ? { borderColor: 'var(--mantine-primary-color-filled)', backgroundColor: 'var(--mantine-primary-color-light)' }
        : { borderColor: 'transparent', color: 'var(--mantine-color-dimmed)' }}
    >
      {isOver ? 'Drop to ungroup' : ''}
    </div>
  );
}

function LayerThumb({ layer, onClick }: { layer: CanvasLayer; onClick: () => void }) {
  const url = useLayerSelectedThumb(layer.id, layer.selectedHistoryId);
  return (
    <UnstyledButton
      onClick={onClick}
      aria-label={`Select ${layer.name}`}
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-default bg-[repeating-conic-gradient(theme(colors.zinc.700)_0%_25%,transparent_0%_50%)] bg-[length:8px_8px] text-[var(--mantine-color-dimmed)]"
    >
      {url
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <IconPhoto size={18} />}
    </UnstyledButton>
  );
}

// ── Per-layer history strip ─────────────────────────────────────────────────
// Expanded under each layer row. Lists the layer's stamped history entries
// newest-first as small thumbnails; clicking one sets that entry as the
// layer's `selectedHistoryId` and stamps its blob into the canvas sprite.
// Same effect as ← / → arrow nav via navigateLayerHistory.

function LayerHistoryList({ layer }: { layer: CanvasLayer }) {
  const updateCanvasLayer = useCanvasStore(s => s.updateCanvasLayer);
  const [entries, setEntries] = useState<LayerHistoryEntry[] | null>(null);
  const urlsRef = useRef<Map<string, string>>(new Map());
  // Force re-render when urlsRef gains entries.
  const [, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);

  // Refetch whenever the layer's selectedHistoryId changes — a new gen stamps
  // a fresh entry + advances the pointer, so this is the cheapest signal that
  // the per-layer history list has changed.
  useEffect(() => {
    let cancelled = false;
    canvasStorage.listLayerHistory(layer.id).then(rows => {
      if (cancelled) return;
      rows.sort((a, b) => a.at - b.at);
      setEntries(rows);
    });
    return () => { cancelled = true; };
  }, [layer.id, layer.selectedHistoryId]);

  // Maintain blob URLs for the current entry set. Drop URLs for entries that
  // disappeared; create URLs for new ones lazily.
  useEffect(() => {
    if (!entries) return;
    const present = new Set(entries.map(e => e.id));
    let changed = false;
    for (const [id, u] of [...urlsRef.current]) {
      if (!present.has(id)) {
        URL.revokeObjectURL(u);
        urlsRef.current.delete(id);
        changed = true;
      }
    }
    let cancelled = false;
    (async () => {
      for (const e of entries) {
        if (cancelled) return;
        if (urlsRef.current.has(e.id)) continue;
        const blob = await canvasStorage.getBlob(e.blobId);
        if (cancelled || !blob) continue;
        // Brush-commit entries are PIBR-format raw RGBA, not PNG — the
        // browser can't decode them as an <img> source. blobToDisplayUrl
        // detects PIBR vs PNG and returns a URL that an <img> can render.
        const url = await blobToDisplayUrl(blob);
        if (cancelled) { URL.revokeObjectURL(url); continue; }
        urlsRef.current.set(e.id, url);
        bump();
      }
    })();
    if (changed) bump();
    return () => { cancelled = true; };
  }, [entries]);

  // Revoke all URLs on unmount (panel collapse / layer delete).
  useEffect(() => () => {
    urlsRef.current.forEach(u => URL.revokeObjectURL(u));
    urlsRef.current.clear();
  }, []);

  const onDelete = async (entry: LayerHistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    // If we're deleting the selected entry, pick the next-most-recent
    // surviving one (or clear) so the sprite has somewhere to land.
    let nextSelected: string | undefined = layer.selectedHistoryId;
    if (entry.id === layer.selectedHistoryId && entries) {
      const survivors = entries.filter(e2 => e2.id !== entry.id);
      const newest = survivors.sort((a, b) => b.at - a.at)[0];
      nextSelected = newest?.id;
      updateCanvasLayer(layer.id, { selectedHistoryId: nextSelected });
    }
    try {
      await canvasStorage.deleteLayerHistoryEntry(layer.id, entry.id);
    } catch (err) {
      console.warn('[LayerHistoryList] delete failed', err);
      return;
    }
    // Revoke + drop the URL.
    const url = urlsRef.current.get(entry.id);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(entry.id);
    }
    setEntries(prev => prev ? prev.filter(e2 => e2.id !== entry.id) : prev);
  };

  const onPick = async (entry: LayerHistoryEntry) => {
    if (entry.id === layer.selectedHistoryId) return;
    updateCanvasLayer(layer.id, { selectedHistoryId: entry.id });
    // Canvas display needs the ORIGINAL blob (PIBR / PNG) so the
    // controller's setLayerImage can dispatch on magic bytes. The cached
    // URL in urlsRef is a PNG conversion for the thumbnail strip — using
    // it on the canvas would lose the byte-exact PIBR roundtrip.
    const blob = await canvasStorage.getBlob(entry.blobId);
    if (!blob) return;
    const fresh = URL.createObjectURL(blob);
    getCanvasController()?.setLayerImage(layer.id, fresh, entry.blobId);
  };

  if (entries === null) {
    return (
      <Text size="xs" c="dimmed" fs="italic" ml={28} mt={4} px={8} py={6}>
        Loading…
      </Text>
    );
  }
  if (entries.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic" ml={28} mt={4} px={8} py={6}>
        No history yet — generate to stamp something.
      </Text>
    );
  }

  return (
    <div className="ml-7 mt-1 flex flex-wrap gap-1.5 px-1 pb-1">
      {entries.map(e => {
        const url = urlsRef.current.get(e.id);
        const selected = e.id === layer.selectedHistoryId;
        return (
          <div
            key={e.id}
            // v1 thumbnail: a 2px primary ring when selected, dimmed otherwise.
            className={cn(
              'group relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border-2 bg-bg-elev transition-all duration-150',
              selected
                ? 'border-[var(--mantine-primary-color-filled)]'
                : 'border-transparent opacity-70 hover:opacity-100',
            )}
          >
            <button
              type="button"
              onClick={() => onPick(e)}
              title={`${new Date(e.at).toLocaleString()}\n${e.positive.slice(0, 120)}`}
              className="block h-full w-full"
            >
              {url
                ? <img src={url} alt="" className="h-full w-full object-cover" />
                : <span className="block h-full w-full" />}
            </button>
            <ActionIcon
              variant="filled"
              color="red"
              size={16}
              radius="xl"
              onClick={(ev) => { void onDelete(e, ev); }}
              title="Delete this history entry"
              aria-label="Delete this history entry"
              className="!absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <IconX size={10} />
            </ActionIcon>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Per-layer "copy params from another layer" trigger + popover picker
 * (#41). Source = any OTHER layer; destination = this row's layer. Hidden
 * when there's no other layer to copy from. Stops click propagation so
 * opening the popover doesn't also activate the layer.
 */
function CopyParamsButton({ targetLayerId }: { targetLayerId: string }) {
  // Select the raw array (stable reference unless layers actually change),
  // then derive the filtered + sorted list outside the selector — returning
  // a fresh array from the selector itself trips Zustand v5's
  // getSnapshot-must-be-cached invariant and causes infinite re-renders.
  const allLayers = useCanvasStore(s => s.canvasLayers);
  const duplicateLayerParams = useCanvasStore(s => s.duplicateLayerParams);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => allLayers
      .filter(l => l.id !== targetLayerId)
      .sort((a, b) => b.zIndex - a.zIndex),
    [allLayers, targetLayerId],
  );

  if (sorted.length === 0) return null;

  return (
    <Menu opened={open} onChange={setOpen} position="bottom-end" width={220} shadow="md" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="default"
          size={28}
          className="!w-auto min-w-7 flex-1"
          // The menu toggles itself; this only keeps the click from reaching the row.
          onClick={(e) => e.stopPropagation()}
          title="Copy params from another layer"
          aria-label="Copy params from another layer"
        >
          <IconCopy size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Label>Copy params from…</Menu.Label>
        <div className="scroll-y max-h-[280px]">
          {sorted.map(l => (
            <Menu.Item
              key={l.id}
              onClick={(e) => {
                e.stopPropagation();
                duplicateLayerParams(l.id, targetLayerId);
              }}
              leftSection={<Text size="10px" c="dimmed" ff="monospace">z{l.zIndex}</Text>}
            >
              <Text size="sm" truncate>{l.name}</Text>
            </Menu.Item>
          ))}
        </div>
      </Menu.Dropdown>
    </Menu>
  );
}

/** A layer-row action: v1's default ActionIcon, stretched so the row's actions share its width. */
function RowBtn({
  onClick, title, danger, on, dim, children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  /** Toggled on (e.g. locked) — drawn in the primary colour. */
  on?: boolean;
  /** Toggled off (e.g. hidden) — drawn dimmed. */
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={title} withArrow openDelay={400} multiline maw={240}>
      <ActionIcon
        variant={on ? 'light' : 'default'}
        color={danger ? 'red' : undefined}
        size={28}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        aria-label={title}
        className={cn('!w-auto min-w-7 flex-1', danger && 'hover:!text-[var(--mantine-color-red-5)]')}
        c={dim ? 'dimmed' : undefined}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  );
}

/** dnd-kit drag handle for layer and group rows. */
function DragHandle({
  label, attributes, listeners,
}: {
  label: string;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  return (
    <UnstyledButton
      {...attributes}
      {...listeners}
      aria-label={label}
      title={label}
      className="flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--mantine-color-dark-3)] hover:text-[var(--mantine-color-dimmed)] active:cursor-grabbing"
    >
      <IconGripVertical size={14} />
    </UnstyledButton>
  );
}

/** Inline rename field: looks like text until hovered or focused. Enter commits, Escape reverts. */
const NameInput = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
  onEnter: (el: HTMLInputElement) => void;
  onEscape: (el: HTMLInputElement) => void;
  onClick?: (e: React.MouseEvent) => void;
  bold?: boolean;
}>(function NameInput({ value, onChange, onBlur, onFocus, onEnter, onEscape, onClick, bold }, ref) {
  return (
    <TextInput
      ref={ref}
      value={value}
      spellCheck={false}
      variant="unstyled"
      size="xs"
      className="min-w-0 flex-1"
      classNames={{
        input: cn(
          '!h-7 !min-h-0 truncate rounded-sm border border-transparent !px-1 hover:border-[var(--mantine-color-dark-4)]',
          'focus:border-[var(--mantine-primary-color-filled)] focus:bg-[var(--mantine-color-dark-7)]',
          bold && 'font-medium',
        ),
      }}
      onChange={(e) => onChange(e.currentTarget.value)}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter(e.currentTarget);
        else if (e.key === 'Escape') onEscape(e.currentTarget);
      }}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
});

// ── Default new-layer size picker ────────────────────────────────────────────
// Replaces the top-toolbar canvas-size dropdown. Sets the default bounds size
// applied to layers created via +Add. Persisted in canvasStore + localStorage.

function DefaultSizePicker() {
  const size = useCanvasStore(s => s.defaultLayerSize);
  const setSize = useCanvasStore(s => s.setDefaultLayerSize);
  const label = `${size.w}×${size.h}`;
  // Build presets: the existing RESOLUTION_PRESETS list. Include the current
  // value even if it's not a preset so the dropdown shows what's selected.
  const presetStrs = RESOLUTION_PRESETS.map(([w, h]) => `${w}×${h}`);
  const opts = presetStrs.includes(label) ? presetStrs : [label, ...presetStrs];
  return (
    <Tooltip label="Default bounds size for newly-added layers" withArrow>
      <Select
        aria-label="Default size for new layers"
        size="xs"
        w={112}
        data={opts}
        value={label}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, shadow: 'md' }}
        classNames={{ input: 'font-mono !pr-6', section: '!w-6' }}
        onChange={(v) => {
          if (!v) return;
          const [w, h] = v.split('×').map(n => Number(n));
          if (Number.isFinite(w) && Number.isFinite(h)) setSize({ w, h });
        }}
      />
    </Tooltip>
  );
}
