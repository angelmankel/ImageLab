import { PromptWorkspace } from '@/features/layers/PromptWorkspace';
import { GenerateButton } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { GenerationSettings, CompositionSettings, EnhancementSettings } from '@/features/controls/GenerationSettings';
import { PipelinePanel } from '@/features/controls/PipelinePanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InputImageControlSection, ModelsSection } from '@/features/controls/ModelSections';
import { ActionIcon, Group, Switch, Text, Tooltip } from '@mantine/core';
import { StepperInput } from '@/components/fields/StepperInput';
import { IconDice5 } from '@tabler/icons-react';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { useCanvasStore } from '@/lib/canvasStore';
import { useStore } from '@/lib/store';

/** `hideGenerate`: the phone layout has its own floating Generate button, so the footer drops its pair. */
export function LeftPanel({ hideGenerate = false }: { hideGenerate?: boolean }) {
  const mainView = useCanvasStore(s => s.mainView);
  const layer = useCanvasStore(s => s.canvasLayers.find(l => l.id === s.activeLayerId));
  const layerScope = mainView === 'canvas';
  const empty = layerScope && !layer;
  const workflow = useStore(s => s.workflow);
  const setWorkflow = useStore(s => s.setWorkflow);
  return <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
    <PanelToolbar note={layerScope ? layer?.name || 'Select a layer' : undefined} />
    {empty ? <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-fg-muted">Select a canvas layer to edit its prompt and settings.</div> :
      <div className="scroll-y flex min-h-0 flex-1 flex-col overflow-x-hidden px-3 py-1">
        <ErrorBoundary label="Prompts"><PromptWorkspace /></ErrorBoundary>
        <ModelsSection />
        <GenerationSettings layerScope={layerScope} showDenoise={layerScope ? layer?.fillMode !== 'inpaint' : !!workflow.inputImage} />
        {!layerScope && <CompositionSettings />}
        {!layerScope && <InputImageControlSection />}
        <EnhancementSettings disabled={layerScope && layer?.fillMode === 'inpaint'} size={layerScope && layer ? { width: layer.bounds.w, height: layer.bounds.h } : undefined} />
        <ErrorBoundary label="Passes"><PipelinePanel inpaintMode={layerScope && layer?.fillMode === 'inpaint'} /></ErrorBoundary>
      </div>}
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-default p-2.5">
      <GenerationProgress />
      {!empty && <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" w={32}>Seed</Text>
        <StepperInput value={workflow.seed} min={0} max={0xFFFFFFFF} step={1} size="xs" style={{ flex: 1 }}
          onChange={seed => setWorkflow({ seed })} aria-label="Generation seed"
          styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }} />
        <Tooltip label="New random seed">
          <ActionIcon variant="light" color="gray" size="md" onClick={() => setWorkflow({ seed: Math.floor(Math.random() * 0xFFFFFFFF) })} aria-label="New random seed"><IconDice5 size={15} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Pick a new seed for every generation">
          <Switch size="xs" checked={workflow.randomizeSeed} onChange={e => setWorkflow({ randomizeSeed: e.currentTarget.checked })} label={<Text size="xs" c="dimmed">Auto</Text>} aria-label="Randomize seed every generation" />
        </Tooltip>
      </Group>}
      {hideGenerate ? <div className="h-16 shrink-0" aria-hidden /> : <GenerateButton />}
    </div>
  </div>;
}
