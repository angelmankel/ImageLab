import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/storage';
import { createPass, pipelinePasses, withPipeline, PASS_LABELS, type PassKind } from '@/lib/pipeline';
import type { Pass } from '@/lib/types';
import { ControlSection } from './ControlSection';
import { ParamRow } from './ParamRow';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';

const smallButton = 'min-h-8 rounded-md px-2 text-[11px] font-medium text-fg-muted hover:bg-bg-elev hover:text-fg-primary disabled:opacity-25';

export function PipelinePanel({ inpaintMode = false }: { inpaintMode?: boolean }) {
  const workflow = useStore(s => s.workflow);
  const server = useStore(s => s.server);
  const setWorkflow = useStore(s => s.setWorkflow);
  const passes = pipelinePasses(workflow);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ pass: Pass; index: number } | null>(null);
  const save = (next: Pass[]) => setWorkflow(withPipeline(next));
  const update = (id: string, patch: Partial<Pass>) => save(passes.map(p => p.id === id ? { ...p, ...patch } : p));
  const move = (index: number, delta: number) => {
    const next = [...passes];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next);
  };
  const add = (kind: PassKind) => {
    const pass = createPass(workflow, kind, uid());
    pass.upscaleModel ||= server.upscaleModels[0] || '';
    save([...passes, pass]); setExpanded(pass.id); setAdding(false);
  };
  return <ControlSection id="workspace-passes" title="Passes" summary={`${passes.filter(p => p.on !== false && !(inpaintMode && (!p.kind || p.kind === 'sample'))).length} after base image`}
    expandOn={adding} action={<button type="button" className="min-h-9 rounded-md bg-accent-soft px-2.5 text-xs font-semibold text-accent-fg" onClick={() => setAdding(!adding)} aria-label="Add pass" aria-expanded={adding}>+ Add pass</button>}>
    <div className="mb-2 flex items-center gap-2 px-1 py-2 text-xs text-fg-muted"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-fg">1</span>Base image <span className="ml-auto">{workflow.steps} steps</span></div>
    {adding && <div className="mb-3 grid grid-cols-2 gap-2" aria-label="Add a pass">
      {(Object.keys(PASS_LABELS) as PassKind[]).map(kind => <button key={kind} type="button" aria-label={`Add ${PASS_LABELS[kind]} pass`} disabled={inpaintMode && kind === 'sample'} onClick={() => add(kind)}
        className="min-h-14 rounded-lg border border-border-default bg-bg-input px-3 py-2 text-left text-xs hover:border-accent disabled:opacity-40">
        <span className="block font-semibold text-fg-primary">{PASS_LABELS[kind]}</span>
        <span className="mt-1 block text-[10px] text-fg-muted">{kind === 'sample' ? inpaintMode ? 'Whole-image runs only' : 'Another sampling pass' : kind === 'upscale' ? 'Enlarge with a model' : kind === 'resize' ? 'Set the final size' : 'Make it transparent'}</span>
      </button>)}
    </div>}
    {!passes.length && !adding && <p className="px-1 pb-3 text-xs leading-relaxed text-fg-muted">Add refinement or finishing steps here. They run from top to bottom.</p>}
    <div className="flex flex-col gap-2">
      {passes.map((pass, index) => {
        const kind = pass.kind ?? 'sample';
        const unavailable = inpaintMode && kind === 'sample';
        const enabled = pass.on !== false && !unavailable;
        const open = expanded === pass.id;
        const summary = kind === 'sample' ? `${pass.steps} steps · ${pass.denoise} denoise · ${pass.scale}×` : kind === 'remove-bg' ? 'Transparent background' : kind === 'resize' && pass.resizeMode === 'size' ? `${pass.width} × ${pass.height}` : `${pass.scale}×`;
        return <div key={pass.id} className={cn('overflow-hidden rounded-lg border border-border-default bg-bg-panel', !enabled && 'opacity-60')}>
          <div className="flex items-center gap-2 px-2.5">
            <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : pass.id)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-default text-[11px] text-fg-muted">{index + 2}</span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-fg-primary">{PASS_LABELS[kind]}</span><span className="block truncate text-[10px] text-fg-muted">{unavailable ? 'Not applied to inpainting' : summary}</span></span>
              <span className="text-xs text-fg-muted">{open ? '−' : '+'}</span>
            </button>
            <Switch checked={pass.on !== false} onCheckedChange={on => update(pass.id, { on })} ariaLabel={`Enable pass ${index + 2}`} />
          </div>
          <div className="flex items-center gap-0.5 border-t border-border-subtle px-1.5">
            <button type="button" className={smallButton} disabled={index === 0} aria-label={`Move pass ${index + 2} up`} onClick={() => move(index, -1)}>↑ Up</button>
            <button type="button" className={smallButton} disabled={index === passes.length - 1} aria-label={`Move pass ${index + 2} down`} onClick={() => move(index, 1)}>↓ Down</button>
            <button type="button" className={smallButton} aria-label={`Duplicate pass ${index + 2}`} onClick={() => { const clone = { ...pass, id: uid() }; const next = [...passes]; next.splice(index + 1, 0, clone); save(next); setExpanded(clone.id); }}>Duplicate</button>
            <button type="button" className={`${smallButton} ml-auto hover:!text-status-err`} aria-label={`Remove pass ${index + 2}`} onClick={() => { save(passes.filter(p => p.id !== pass.id)); setRemoved({ pass, index }); }}>Remove</button>
          </div>
          {open && <div className="flex flex-col gap-2 border-t border-border-subtle p-2.5">
            <PassFields pass={pass} update={patch => update(pass.id, patch)} />
          </div>}
        </div>;
      })}
    </div>
    {removed && <div role="status" className="mt-2 flex items-center justify-between text-xs text-fg-muted">Pass removed<button type="button" className={`${smallButton} text-accent-fg`} onClick={() => { const next = [...passes]; next.splice(removed.index, 0, removed.pass); save(next); setRemoved(null); }}>Undo</button></div>}
  </ControlSection>;
}

function PassFields({ pass, update }: { pass: Pass; update: (patch: Partial<Pass>) => void }) {
  const server = useStore(s => s.server);
  const kind = pass.kind ?? 'sample';
  const models = [...new Set([pass.upscaleModel, ...server.upscaleModels].filter((m): m is string => !!m))];
  const modelField = <Field label="Model"><Select value={pass.upscaleModel || ''} onValueChange={upscaleModel => update({ upscaleModel })} options={models} ariaLabel="Pass upscale model" /></Field>;
  if (kind === 'remove-bg') return <p className="text-xs leading-relaxed text-fg-muted">Removes the background from the previous step’s image and keeps transparency.</p>;
  return <>
    {kind === 'upscale' && modelField}
    {kind === 'resize' && <Field label="Size by"><Select value={pass.resizeMode || 'factor'} onValueChange={v => update({ resizeMode: v as Pass['resizeMode'] })} options={['factor', 'size']} ariaLabel="Resize mode" /></Field>}
    {kind === 'resize' && pass.resizeMode === 'size' ? <div className="grid grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs text-fg-muted">Width<NumberInput value={pass.width || 1024} min={8} max={16384} step={8} onValueChange={width => update({ width })} ariaLabel="Pass width" /></label><label className="flex flex-col gap-1 text-xs text-fg-muted">Height<NumberInput value={pass.height || 1024} min={8} max={16384} step={8} onValueChange={height => update({ height })} ariaLabel="Pass height" /></label></div> : <ParamRow label="Scale" value={pass.scale} min={0.1} max={4} step={0.05} format={v => `${v}×`} onChange={scale => update({ scale })} />}
    {kind !== 'resize' && <Field label="Max edge"><NumberInput value={pass.maxEdge} min={64} max={16384} step={64} onValueChange={maxEdge => update({ maxEdge })} ariaLabel="Pass maximum edge" /></Field>}
    {kind === 'resize' && <Field label="Method"><Select value={pass.resizeMethod || 'lanczos'} options={['lanczos', 'bicubic', 'bilinear', 'area', 'nearest-exact']} onValueChange={v => update({ resizeMethod: v as Pass['resizeMethod'] })} ariaLabel="Pass resize method" /></Field>}
    {kind === 'sample' && <>
      <ParamRow label="Steps" value={pass.steps} min={1} max={200} onChange={steps => update({ steps })} />
      <ParamRow label="CFG" value={pass.cfg} min={0} max={30} step={0.1} onChange={cfg => update({ cfg })} />
      <ParamRow label="Denoise" value={pass.denoise} min={0} max={1} step={0.01} onChange={denoise => update({ denoise })} />
      <Field label="Sampler"><Select value={pass.sampler} options={[...new Set([pass.sampler, ...server.samplers])]} onValueChange={sampler => update({ sampler })} ariaLabel="Pass sampler" /></Field>
      <Field label="Scheduler"><Select value={pass.scheduler} options={[...new Set([pass.scheduler, ...server.schedulers])]} onValueChange={scheduler => update({ scheduler })} ariaLabel="Pass scheduler" /></Field>
      {pass.scale !== 1 && <><Field label="Enlarge in"><Select value={pass.upscaleMode || 'latent'} options={['latent', 'model']} onValueChange={v => update({ upscaleMode: v as Pass['upscaleMode'] })} ariaLabel="Pass enlargement method" /></Field>{pass.upscaleMode === 'model' && modelField}</>}
      <Field label="Seed"><NumberInput value={pass.seed} min={0} step={1} onValueChange={seed => update({ seed })} ariaLabel="Pass seed" /></Field>
      <label className="flex min-h-9 items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={pass.randomizeSeed} onChange={e => update({ randomizeSeed: e.target.checked })} />New seed each run</label>
    </>}
  </>;
}
