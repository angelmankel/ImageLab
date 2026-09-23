import { memo, type DragEvent } from 'react';
import { ActionIcon, Badge, Group, Tooltip } from '@mantine/core';
import { IconInfoCircle, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { cn } from '@/lib/cn';

interface HistoryGridItemProps {
  id: string;
  url: string;
  filename: string;
  label: string;
  liked: boolean;
  selected: boolean;
  /** Server name badge; null when the tab already filters to one server. */
  serverLabel: string | null;
  size?: [number, number];
  onSelect: () => void;
  onToggleLiked: () => void;
  onDelete: () => void;
  onInfo: () => void;
  onNaturalSize: (w: number, h: number) => void;
}

/** Hover-only on pointer devices; always shown on touch, where there is no hover. */
const HOVER_ONLY = 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

/**
 * v1's OutputGridItem: a square, rounded tile with the whole image contained
 * on a dark ground, a 2px border in the theme colour when selected, and a small
 * row of filled dark action icons in the top-right corner.
 *
 * Browsers do not allow nested buttons, so the image trigger is a sibling
 * `<button>` and the actions sit above it. Dragging carries the same payload as
 * `ImageTile`, which the canvas drop handler reads.
 */
export const HistoryGridItem = memo(function HistoryGridItem({
  id, url, filename, label, liked, selected, serverLabel, size,
  onSelect, onToggleLiked, onDelete, onInfo, onNaturalSize,
}: HistoryGridItemProps) {
  const onDragStart = (e: DragEvent<HTMLImageElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-imagelab-image', JSON.stringify({ url, name: filename }));
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.setData('text/plain', url);
    const img = e.currentTarget;
    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
  };

  return (
    <div
      data-history-id={id}
      className={cn(
        'group relative aspect-square overflow-hidden border-2 transition-[border-color] duration-100',
        selected
          ? 'border-(--mantine-primary-color-filled)'
          : 'border-transparent hover:border-(--mantine-color-dark-3)',
      )}
      style={{ borderRadius: 'var(--mantine-radius-sm)', backgroundColor: 'var(--mantine-color-dark-6)' }}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onSelect}
        className="absolute inset-0 flex cursor-grab items-center justify-center"
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          draggable
          onDragStart={onDragStart}
          onLoad={(e) => onNaturalSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          className="h-full w-full object-contain"
        />
      </button>

      <Group gap={2} pos="absolute" top={4} right={4} style={{ zIndex: 10 }} wrap="nowrap">
        <Tooltip label="Details" withinPortal openDelay={400} fz="xs">
          <ActionIcon
            size="xs"
            variant="filled"
            color="dark"
            aria-label="Image details"
            onClick={(e) => { e.stopPropagation(); onInfo(); }}
            className={HOVER_ONLY}
          >
            <IconInfoCircle size={12} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={liked ? 'Unfavorite' : 'Favorite'} withinPortal openDelay={400} fz="xs">
          <ActionIcon
            size="xs"
            variant="filled"
            color={liked ? 'yellow' : 'dark'}
            aria-label={liked ? 'Unfavorite' : 'Favorite'}
            aria-pressed={liked}
            onClick={(e) => { e.stopPropagation(); onToggleLiked(); }}
            // A favourite keeps its star visible, so the grid shows what is kept at a glance.
            className={liked ? undefined : HOVER_ONLY}
          >
            {liked ? <IconStarFilled size={12} /> : <IconStar size={12} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete" withinPortal openDelay={400} fz="xs">
          <ActionIcon
            size="xs"
            variant="filled"
            color="dark"
            aria-label="Delete image"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={cn(HOVER_ONLY, 'hover:!bg-(--mantine-color-red-8)')}
          >
            <IconTrash size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {size && (
        <Badge
          size="xs"
          variant="filled"
          color="dark"
          radius="sm"
          pos="absolute"
          bottom={4}
          left={4}
          tt="none"
          ff="monospace"
          className={cn('pointer-events-none', HOVER_ONLY)}
        >
          {size[0]}×{size[1]}
        </Badge>
      )}
      {serverLabel && (
        <Badge
          size="xs"
          variant="filled"
          color="dark"
          radius="sm"
          pos="absolute"
          bottom={4}
          right={4}
          tt="none"
          fw={500}
          className="pointer-events-none"
          style={{ opacity: 0.85, maxWidth: '60%' }}
        >
          {serverLabel}
        </Badge>
      )}
    </div>
  );
});
