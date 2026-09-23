import { PromptWorkspace } from '@/features/layers/PromptWorkspace';
import { GenerateButton } from '@/features/generate/GenerateButton';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { GenerationSettings } from '@/features/controls/GenerationSettings';
import { PipelinePanel } from '@/features/controls/PipelinePanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InputImageControlSection, ModelsSection } from '@/features/controls/ModelSections';
import { NumberInput } from '@/components/ui/NumberInput';
import { useCanvasStore } from '@/lib/canvasStore';
import { useStore } from '@/lib/store';

export function LeftPanel() {
  const mainView = useCanvasStore(s => s.mainView);
  const layer = useCanvasStore(s => s.canvasLayers.find(l => l.id === s.activeLayerId));
  const layerScope = mainView === 'canvas';
  const empty = layerScope && !layer;
  const workflow = useStore(s => s.workflow);
  const setWorkflow = useStore(s => s.setWorkflow);
  return <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
    <div className="shrink-0 border-b border-border-subtle px-3.5 py-3">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-fg-primary">Create</h2><span className="max-w-48 truncate text-xs text-fg-muted">{layerScope ? layer?.name || 'Select a layer' : 'Image workspace'}</span></div>
      <p className="mt-1 text-[11px] text-fg-muted">Shape the prompt. Build the passes. Generate.</p>
    </div>
    {empty ? <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-fg-muted">Select a canvas layer to edit its prompt and settings.</div> :
      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-3 py-3">
        <ErrorBoundary label="Prompts"><PromptWorkspace /></ErrorBoundary>
        <ModelsSection />
        <GenerationSettings layerScope={layerScope} showDenoise={!layerScope || layer?.fillMode !== 'inpaint'} />
        {!layerScope && <InputImageControlSection />}
        <ErrorBoundary label="Passes"><PipelinePanel inpaintMode={layerScope && layer?.fillMode === 'inpaint'} /></ErrorBoundary>
      </div>}
    <div className="flex shrink-0 flex-col gap-3 border-t border-border-default bg-bg-panel px-3.5 pb-3.5 pt-3">
      <GenerationProgress />
      {!empty && <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-fg-muted">Seed</span>
        <NumberInput value={workflow.seed} min={0} max={0xFFFFFFFF} step={1} onValueChange={seed => setWorkflow({ seed })} ariaLabel="Generation seed" className="!py-1.5 !text-xs" />
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-fg-muted"><input type="checkbox" checked={workflow.randomizeSeed} onChange={e => setWorkflow({ randomizeSeed: e.target.checked })} />Auto</label>
      </div>}
      <GenerateButton />
    </div>
  </div>;
}
