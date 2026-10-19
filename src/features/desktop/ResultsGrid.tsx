/**
 * The right column for Video and Workflow: every result the run store knows (the server's own
 * `/history`, so other clients' runs too), newest first, as a grid. Click shows it in the hero;
 * the image mode's right column is the history panel, which does the same for images.
 */
import { useMemo } from 'react';
import { Badge, Group, Slider, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconLayoutGrid, IconMovie, IconPhoto } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import type { RunStore } from '@/lib/comfyRunner';
import { isVideoFile, type WorkspaceMode } from '@/lib/workspace';
import { useVideoRun } from '@/features/video/videoRun';
import { useWorkflowRun } from '@/features/studio/studioRun';
import { useDesktopLayout } from './desktopLayoutStore';

export function ResultsGrid({ mode, currentKey, onPick }: { mode: WorkspaceMode; currentKey: string | null; onPick: (key: string) => void }) {
  const store: RunStore = mode === 'video' ? useVideoRun : useWorkflowRun;
  const results = store(s => s.results);
  const columns = useDesktopLayout(s => s.gridColumns);
  const setColumns = useDesktopLayout(s => s.setGridColumns);
  const Icon = mode === 'video' ? IconMovie : IconPhoto;
  const title = mode === 'video' ? 'Videos' : 'Results';
  const items = useMemo(() => results.map(r => ({ key: r.url, url: r.url, video: isVideoFile(r.filename), filename: r.filename })), [results]);

  return (
    <aside className="flex h-full min-h-0 flex-col" aria-label={title}>
      <Group justify="space-between" gap="xs" wrap="nowrap" px="xs" py={6} className="shrink-0 border-b border-border-default">
        <Group gap={6} wrap="nowrap">
          <Icon size={14} style={{ opacity: 0.6 }} />
          <Text size="sm" fw={600}>{title}</Text>
          <Badge size="xs" variant="light" color="gray">{items.length}</Badge>
        </Group>
        <Tooltip label="Grid size" withinPortal fz="xs">
          <Group gap={6} wrap="nowrap">
            <IconLayoutGrid size={14} style={{ opacity: 0.5 }} />
            <Slider aria-label="Grid columns" value={columns} onChange={setColumns} min={2} max={5} step={1} size="xs" label={null} w={64} styles={{ thumb: { display: 'none' } }} />
          </Group>
        </Tooltip>
      </Group>
      <div className="scroll-y min-h-0 flex-1 p-2">
        {items.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic" ta="center" py="lg">Nothing on this server yet.</Text>
        ) : (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {items.map(it => (
              <UnstyledButton key={it.key} onClick={() => onPick(it.key)} aria-label={`Show ${it.filename}`} title={it.filename}
                className={cn('relative aspect-square overflow-hidden rounded-sm border-2 transition-all duration-150',
                  it.key === currentKey ? 'border-[var(--mantine-primary-color-filled)]' : 'border-transparent opacity-80 hover:opacity-100')}>
                {it.video
                  ? <video src={it.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  : <img src={it.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                {it.video && <IconMovie size={12} className="absolute bottom-1 right-1 text-white/80 drop-shadow" />}
              </UnstyledButton>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
