import { useStore } from '@/lib/store';
import { ControlSection } from './ControlSection';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { ParamRow } from './ParamRow';
import { RESOLUTION_PRESETS } from '@/lib/storage';

export function GenerationSettings({ layerScope, showDenoise }: { layerScope: boolean; showDenoise: boolean }) {
  const w = useStore(s => s.workflow);
  const set = useStore(s => s.setWorkflow);
  const server = useStore(s => s.server);
  const size = `${w.width} × ${w.height}`;
  return <ControlSection id="workspace-base" title="Base image" summary={`${w.steps} steps · ${layerScope ? 'Layer size' : size}`} defaultCollapsed>
    <ParamRow label="Steps" value={w.steps} min={1} max={200} onChange={steps => set({ steps })} />
    <ParamRow label="CFG" value={w.cfg} min={0} max={30} step={0.1} onChange={cfg => set({ cfg })} />
    <Field label="Sampler"><Select value={w.sampler} options={[...new Set([w.sampler, ...server.samplers])]} onValueChange={sampler => set({ sampler })} ariaLabel="Sampler" /></Field>
    <Field label="Scheduler"><Select value={w.scheduler} options={[...new Set([w.scheduler, ...server.schedulers])]} onValueChange={scheduler => set({ scheduler })} ariaLabel="Scheduler" /></Field>
    {!layerScope && <>
      <Field label="Size"><Select value={size} options={[...new Set([size, ...RESOLUTION_PRESETS.map(([width, height]) => `${width} × ${height}`)])]} onValueChange={v => { const [width, height] = v.split(' × ').map(Number); set({ width, height }); }} ariaLabel="Output size" /></Field>
      <div className="my-2 grid grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs text-fg-muted">Width<NumberInput value={w.width} min={64} max={4096} step={8} onValueChange={width => set({ width })} ariaLabel="Output width" /></label><label className="flex flex-col gap-1 text-xs text-fg-muted">Height<NumberInput value={w.height} min={64} max={4096} step={8} onValueChange={height => set({ height })} ariaLabel="Output height" /></label></div>
      <ParamRow label="Batch" value={w.batch} min={1} max={64} onChange={batch => set({ batch })} />
    </>}
    {showDenoise && <ParamRow label="Denoise" value={layerScope ? w.inputDenoise : w.denoise} min={0} max={1} step={0.01} onChange={value => set(layerScope ? { inputDenoise: value } : { denoise: value })} />}
  </ControlSection>;
}
