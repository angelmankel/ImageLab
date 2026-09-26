import { useMemo } from 'react';
import { GenerateButton } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { ActionIcon, Group, Switch, Text, Tooltip } from '@mantine/core';
import { StepperInput } from '@/components/fields/StepperInput';
import { IconDice5 } from '@tabler/icons-react';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { PanelTabs } from '@/features/panel/PanelTabs';
import { SEED_INPUT_ID } from '@/features/panel/SummaryStrip';
import type { PanelScope } from '@/features/panel/sections';
import { useCanvasStore } from '@/lib/canvasStore';
import { useStore } from '@/lib/store';

/** `hideGenerate`: the phone layout has its own floating Generate button, so the footer drops its pair. */
export function LeftPanel({ hideGenerate = false }: { hideGenerate?: boolean }) {
  const mainView = useCanvasStore(s => s.mainView);
  const layer = useCanvasStore(s => s.canvasLayers.find(l => l.id === s.activeLayerId));
  const layerScope = mainView === 'canvas';
  const empty = layerScope && !layer;
  const seed = useStore(s => s.workflow.seed);
  const randomizeSeed = useStore(s => s.workflow.randomizeSeed);
  const hasInput = useStore(s => !!s.workflow.inputImage);
  const setWorkflow = useStore(s => s.setWorkflow);

  // Built from primitives so the tabs (and every section's status) only re-render when it changes.
  const inpaint = layerScope && layer?.fillMode === 'inpaint';
  const lw = layerScope ? layer?.bounds.w : undefined;
  const lh = layerScope ? layer?.bounds.h : undefined;
  const scope = useMemo<PanelScope>(() => ({
    layerScope,
    inpaint,
    showDenoise: layerScope ? !inpaint : hasInput,
    size: lw != null && lh != null ? { width: lw, height: lh } : undefined,
  }), [layerScope, inpaint, hasInput, lw, lh]);

  return <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
    <PanelToolbar note={layerScope ? layer?.name || 'Select a layer' : undefined} />
    {empty
      ? <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-fg-muted">Select a canvas layer to edit its prompt and settings.</div>
      : <PanelTabs scope={scope} />}
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-default p-2.5">
      <GenerationProgress />
      {!empty && <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" w={32}>Seed</Text>
        <StepperInput id={SEED_INPUT_ID} value={seed} min={0} max={0xFFFFFFFF} step={1} size="xs" style={{ flex: 1 }}
          onChange={seed => setWorkflow({ seed })} aria-label="Generation seed"
          styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
        <Tooltip label="New random seed">
          <ActionIcon variant="light" color="gray" size="md" onClick={() => setWorkflow({ seed: Math.floor(Math.random() * 0xFFFFFFFF) })} aria-label="New random seed"><IconDice5 size={15} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Pick a new seed for every generation">
          <Switch size="xs" checked={randomizeSeed} onChange={e => setWorkflow({ randomizeSeed: e.currentTarget.checked })} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
        </Tooltip>
      </Group>}
      {hideGenerate ? <div className="h-16 shrink-0" aria-hidden /> : <GenerateButton />}
    </div>
  </div>;
}
