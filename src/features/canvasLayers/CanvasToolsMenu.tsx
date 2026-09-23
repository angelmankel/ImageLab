/**
 * Canvas top-nav "Tools" menu — one-shot ComfyUI image manipulations targeted
 * at the active layer's currently-selected history image. Each entry is a
 * ToolGraphBuilder from `lib/imageJobs`; the runActiveLayerTool helper handles
 * server selection, blob fetch, queue, polling, and per-layer history stamp.
 */
import { useState, type ComponentType } from 'react';
import { Button, Loader, Menu, Text, ThemeIcon } from '@mantine/core';
import { IconAdjustments, IconBlur, IconEraser, IconSparkles, IconTriangleInverted } from '@tabler/icons-react';
import { useCanvasStore } from '@/lib/canvasStore';
import {
  blurGraph,
  invertGraph,
  removeBackgroundGraph,
  sharpenGraph,
  type ToolGraphBuilder,
} from '@/lib/imageJobs';
import { runActiveLayerTool } from './runLayerTool';

type ToolEntry = {
  id: string;
  label: string;
  blurb: string;
  Icon: ComponentType<{ size?: number | string }>;
  graph: ToolGraphBuilder;
};

const TOOLS: ToolEntry[] = [
  {
    id: 'remove-bg',
    label: 'Remove background',
    blurb: 'BRIA RMBG — cleanly cut out the subject.',
    Icon: IconEraser,
    graph: removeBackgroundGraph,
  },
  {
    id: 'blur',
    label: 'Blur',
    blurb: 'Gaussian blur — soften the whole image.',
    Icon: IconBlur,
    graph: blurGraph,
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    blurb: 'Unsharp mask — pull out fine detail.',
    Icon: IconSparkles,
    graph: sharpenGraph,
  },
  {
    id: 'invert',
    label: 'Invert colors',
    blurb: 'Photographic negative.',
    Icon: IconTriangleInverted,
    graph: invertGraph,
  },
];

export function CanvasToolsMenu() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const hasLayer = useCanvasStore(s => s.activeLayerId !== null);
  const activeLayer = useCanvasStore(s =>
    s.activeLayerId ? s.canvasLayers.find(l => l.id === s.activeLayerId) ?? null : null);
  const hasSource = !!activeLayer?.selectedHistoryId;

  const onRun = async (tool: ToolEntry) => {
    if (running) return;
    setRunning(tool.id);
    try {
      await runActiveLayerTool(tool.label, tool.graph);
    } finally {
      setRunning(null);
      setOpen(false);
    }
  };

  const disabled = !hasLayer || !hasSource;

  return (
    // Stays open while a tool runs so its spinner is visible; closes when the run settles.
    <Menu opened={open} onChange={setOpen} closeOnItemClick={false} position="bottom" width={260} shadow="md" withinPortal>
      <Menu.Target>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconAdjustments size={14} />}
          title={disabled
            ? 'Select a layer with an image to run image tools.'
            : 'ComfyUI image tools (Remove BG, Blur, …)'}
          aria-label="Image tools"
          disabled={disabled}
        >
          Tools
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Image tools</Menu.Label>
        {TOOLS.map(t => {
          const isRunning = running === t.id;
          return (
            <Menu.Item
              key={t.id}
              onClick={() => { void onRun(t); }}
              disabled={!!running && !isRunning}
              leftSection={
                <ThemeIcon variant="light" color="gray" size="md">
                  {isRunning ? <Loader size={12} /> : <t.Icon size={14} />}
                </ThemeIcon>
              }
            >
              <Text size="sm" fw={500}>{t.label}{isRunning ? '…' : ''}</Text>
              <Text size="xs" c="dimmed" lh={1.3}>{t.blurb}</Text>
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Text size="10px" c="dimmed" px="sm" py={4}>
          Runs on the next round-robin server. Result stamps a new history entry.
        </Text>
      </Menu.Dropdown>
    </Menu>
  );
}
