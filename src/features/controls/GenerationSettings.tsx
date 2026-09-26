import { Stack } from '@mantine/core';
import { useStore } from '@/lib/store';
import { SelectField, SliderField, DimensionsField, LoopbackField } from '@/components/fields';
import { DEFAULT_CLIP_SKIP, DEFAULT_LOOPBACK } from '@/lib/pipeline';

const CLIP_SKIP_OPTIONS = [-1, -2, -3, -4].map(n => ({ value: String(n), label: n === -1 ? '-1 (off)' : String(n) }));

/**
 * v1's "Parameters" section: sampler and scheduler selects, then steps, CFG and — when an
 * image is being reworked — denoise, each as a v1 slider field with presets.
 */
export function GenerationSettings({ layerScope, showDenoise }: { layerScope: boolean; showDenoise: boolean }) {
  const w = useStore(s => s.workflow);
  const set = useStore(s => s.setWorkflow);
  const server = useStore(s => s.server);
  const denoise = layerScope ? w.inputDenoise : w.denoise;
  return (
    <Stack gap="md">
      <SelectField label="Sampler" placeholder="Select sampler..." value={w.sampler} data={[...new Set([w.sampler, ...server.samplers])]} onChange={sampler => set({ sampler })} />
      <SelectField label="Scheduler" placeholder="Select scheduler..." value={w.scheduler} data={[...new Set([w.scheduler, ...server.schedulers])]} onChange={scheduler => set({ scheduler })} />
      <SliderField label="Steps" value={w.steps} min={1} max={100} step={1} defaultValue={25} onChange={steps => set({ steps })} />
      <SliderField label="CFG Scale" value={w.cfg} min={1} max={20} step={0.5} defaultValue={7} onChange={cfg => set({ cfg })} />
      <SelectField label="Clip Skip" value={String(w.clipSkip ?? DEFAULT_CLIP_SKIP)} searchable={false} data={CLIP_SKIP_OPTIONS} onChange={v => set({ clipSkip: Number(v) })} />
      {showDenoise && (
        <SliderField label="Denoise" value={denoise} min={0} max={1} step={0.05} defaultValue={1} onChange={v => set(layerScope ? { inputDenoise: v } : { denoise: v })} />
      )}
    </Stack>
  );
}

/** v1's "Composition" section: output dimensions and how many images per run. */
export function CompositionSettings() {
  const w = useStore(s => s.workflow);
  const set = useStore(s => s.setWorkflow);
  return (
    <Stack gap="md">
      <DimensionsField value={{ width: w.width, height: w.height }} onChange={({ width, height }) => set({ width, height })} />
      <SliderField label="Batch Size" value={w.batch} min={1} max={16} step={1} defaultValue={1} presets={[1, 2, 4, 8, 16]} onChange={batch => set({ batch })} />
    </Stack>
  );
}

/** v1's "Enhancement" section: Loopback (hires fix). Its rounds run before the Passes list. */
/** `size` is what the base image renders at — the canvas layer's bounds in layer scope. */
export function EnhancementSettings({ disabled, size }: { disabled?: boolean; size?: { width: number; height: number } }) {
  const loopback = useStore(s => s.workflow.loopback) ?? DEFAULT_LOOPBACK;
  const width = useStore(s => s.workflow.width);
  const height = useStore(s => s.workflow.height);
  const base = size ?? { width, height };
  const set = useStore(s => s.setWorkflow);
  return (
    <LoopbackField
      value={loopback}
      onChange={v => set({ loopback: v })}
      baseSize={base}
      description={disabled ? 'Not used while inpainting a canvas layer.' : 'Re-render the image a few times, a little larger each time, before the passes below.'}
      disabled={disabled}
    />
  );
}
