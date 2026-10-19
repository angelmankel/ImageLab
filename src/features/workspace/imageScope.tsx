/**
 * What the image mode's sections edit (the generate workflow, or the active canvas layer), and the
 * seed row every layout pins near Generate. Shared by the phone and desktop shells.
 */
import { useMemo } from 'react';
import { ActionIcon, Group, Switch, Text, Tooltip } from '@mantine/core';
import { IconDice5 } from '@tabler/icons-react';
import { StepperInput } from '@/components/fields/StepperInput';
import type { PanelScope } from '@/features/panel/sections';
import { SEED_INPUT_ID } from '@/features/panel/SummaryStrip';
import { useCanvasStore } from '@/lib/canvasStore';
import { useStore } from '@/lib/store';

/** `empty`: canvas view, no layer picked. */
export function usePanelScope() {
  const mainView = useCanvasStore(s => s.mainView);
  const layer = useCanvasStore(s => s.canvasLayers.find(l => l.id === s.activeLayerId));
  const hasInput = useStore(s => !!s.workflow.inputImage);
  const layerScope = mainView === 'canvas';

  // Built from primitives so the sections' status only re-renders when it changes.
  const inpaint = layerScope && layer?.fillMode === 'inpaint';
  const lw = layerScope ? layer?.bounds.w : undefined;
  const lh = layerScope ? layer?.bounds.h : undefined;
  const scope = useMemo<PanelScope>(() => ({
    layerScope,
    inpaint,
    showDenoise: layerScope ? !inpaint : hasInput,
    size: lw != null && lh != null ? { width: lw, height: lh } : undefined,
  }), [layerScope, inpaint, hasInput, lw, lh]);
  return { scope, empty: layerScope && !layer, note: layerScope ? layer?.name || 'Select a layer' : undefined };
}

/** Seed, a new random one, and Auto (a new seed every run). */
export function SeedRow() {
  const seed = useStore(s => s.workflow.seed);
  const randomizeSeed = useStore(s => s.workflow.randomizeSeed);
  const setWorkflow = useStore(s => s.setWorkflow);
  return <Group gap="xs" wrap="nowrap">
    <Text size="xs" c="dimmed" w={32}>Seed</Text>
    <StepperInput id={SEED_INPUT_ID} value={seed} min={0} max={0xFFFFFFFF} step={1} size="xs" style={{ flex: 1, minWidth: 0 }}
      onChange={seed => setWorkflow({ seed })} aria-label="Generation seed"
      styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
    <Tooltip label="New random seed">
      <ActionIcon variant="light" color="gray" size="md" onClick={() => setWorkflow({ seed: Math.floor(Math.random() * 0xFFFFFFFF) })} aria-label="New random seed"><IconDice5 size={15} /></ActionIcon>
    </Tooltip>
    <Tooltip label="Pick a new seed for every generation">
      <Switch size="xs" checked={randomizeSeed} onChange={e => setWorkflow({ randomizeSeed: e.currentTarget.checked })} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
    </Tooltip>
  </Group>;
}
