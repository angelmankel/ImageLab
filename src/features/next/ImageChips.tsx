/**
 * The Image step's settings as chips, in short titled rows that are always all on screen (no
 * tiers, no folding cards): Model · Size · Quality · Input · Passes. Each chip reads `Name value`
 * (`lib/chips.ts` does the words) and opens its editor — preset values to tap, then the real
 * field the old sections used (`components/fields`, `components/models/ModelFields`,
 * `features/inputImage`, `features/controls`), so nothing is lost and nothing is duplicated.
 * The search box on top finds a chip by name across the rows.
 */
import { useMemo, useState } from 'react';
import { Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { DimensionsField, SelectField, SliderField } from '@/components/fields';
import { DIMENSION_PRESETS, SD15_DIMENSION_PRESETS } from '@/components/fields/DimensionsField';
import { CheckpointsField, EmbeddingsField, LorasField, TextEncoderField, VaeField } from '@/components/models/ModelFields';
import { ModelProfileModal } from '@/components/models/ModelProfileModal';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { filterChips, fmtNum, imageChipValues, type ImageChipId } from '@/lib/chips';
import { DEFAULT_CLIP_SKIP, listedPasses } from '@/lib/pipeline';
import { profileTagOn } from '@/lib/modelProfiles';
import { missingResources } from '@/lib/routing';
import { defaultWorkflow } from '@/lib/storage';
import { useStore } from '@/lib/store';
import { EnhancementSettings, DENOISE_ENDS } from '@/features/controls/GenerationSettings';
import { PipelinePanel } from '@/features/controls/PipelinePanel';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { InputImageSection } from '@/features/inputImage';
import { Chip, ChipPopover, ChipRow, type ChipPreset } from './ChipPopover';

interface Def { id: ImageChipId; row: string; label: string; keywords: string[] }

const DEFS: Def[] = [
  { id: 'checkpoint', row: 'Model', label: 'Checkpoint', keywords: ['model', 'base', 'merge', 'ckpt'] },
  { id: 'vae', row: 'Model', label: 'VAE', keywords: ['decoder', 'colour', 'color'] },
  { id: 'loras', row: 'Model', label: 'LoRAs', keywords: ['lora', 'style', 'character', 'strength'] },
  { id: 'embeddings', row: 'Model', label: 'Embeddings', keywords: ['textual inversion', 'negative embedding'] },
  { id: 'quality', row: 'Model', label: 'Quality tags', keywords: ['model type', 'score', 'masterpiece', 'pony', 'illustrious', 'pills'] },
  { id: 'size', row: 'Size', label: 'Size', keywords: ['width', 'height', 'aspect', 'ratio', 'resolution', 'portrait', 'landscape', 'square'] },
  { id: 'batch', row: 'Size', label: 'Batch', keywords: ['images', 'count', 'how many'] },
  { id: 'steps', row: 'Quality', label: 'Steps', keywords: ['sampling', 'iterations'] },
  { id: 'cfg', row: 'Quality', label: 'CFG', keywords: ['guidance', 'scale', 'prompt strength'] },
  { id: 'sampling', row: 'Quality', label: 'Sampler', keywords: ['scheduler', 'euler', 'dpm', 'karras', 'noise'] },
  { id: 'clipSkip', row: 'Quality', label: 'Clip skip', keywords: ['clip', 'layer', 'text encoder'] },
  { id: 'denoise', row: 'Quality', label: 'Denoise', keywords: ['noise', 'txt2img'] },
  { id: 'input', row: 'Input', label: 'Input image', keywords: ['img2img', 'image', 'upload', 'paste', 'inpaint', 'mask', 'edit', 'crop'] },
  { id: 'strength', row: 'Input', label: 'Strength', keywords: ['denoise', 'img2img', 'how much changes'] },
  { id: 'loopback', row: 'Passes', label: 'Loopback', keywords: ['hires fix', 'refine', 'enhance', 'rounds', 'iterations'] },
  { id: 'passes', row: 'Passes', label: 'Passes', keywords: ['upscale', 'resize', 'remove background', 'refine', 'pipeline', 'post'] },
];
const ROWS = ['Model', 'Size', 'Quality', 'Input', 'Passes'];

const STEP_PRESETS = [8, 12, 20, 30, 40];
const CFG_PRESETS = [1, 3, 5, 7, 9];
const BATCH_PRESETS = [1, 2, 4, 8];
const STRENGTH_PRESETS = [0.3, 0.5, 0.6, 0.75, 0.9];
const DENOISE_PRESETS = [0.5, 0.7, 0.85, 1];
const SAMPLER_PICKS = ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde', 'ddim'];
const SCHEDULER_PICKS = ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'beta'];
const CLIP_SKIP_OPTIONS = [-1, -2, -3, -4].map(n => ({ value: String(n), label: n === -1 ? '-1 (off)' : String(n) }));

const nums = (values: number[], current: number, pick: (v: number) => void, fmt = (v: number) => fmtNum(v)): ChipPreset[] =>
  values.map(v => ({ label: fmt(v), on: Math.abs(current - v) < 1e-9, onPick: () => pick(v) }));

export function ImageChips({ large = false }: { large?: boolean }) {
  const w = useStore(s => s.workflow);
  const set = useStore(s => s.setWorkflow);
  const server = useStore(s => s.server);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const { profile } = useModelProfile();
  const [query, setQuery] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);

  const defaults = useMemo(() => ({ ...defaultWorkflow(), ...(profile?.defaults ?? {}) }), [profile]);
  const quality = useMemo(() => {
    if (!profile || !profile.tags.length) return { on: 0, total: 0 };
    return { on: profile.tags.filter(t => profileTagOn(w, profile, t)).length, total: profile.tags.length };
  }, [profile, w]);
  const values = useMemo(() => imageChipValues({ ...w, passCount: listedPasses(w).filter(p => p.on !== false).length }, { ...defaults, clipSkip: defaults.clipSkip ?? DEFAULT_CLIP_SKIP }, quality), [w, defaults, quality]);
  const missing = useMemo(() => (online ? missingResources(w, server) : []), [online, w, server]);
  const warnFor = (id: ImageChipId): string | undefined => {
    const list = id === 'checkpoint' ? missing.filter(m => /^checkpoint /.test(m))
      : id === 'vae' ? missing.filter(m => /^VAE /.test(m))
        : id === 'loras' ? missing.filter(m => /^LoRA /.test(m))
          : id === 'embeddings' ? missing.filter(m => /^embedding /.test(m))
            : id === 'sampling' ? missing.filter(m => /^(sampler|scheduler) /.test(m))
              : id === 'passes' ? missing.filter(m => m.startsWith('Pass ')) : [];
    return list.length ? `Not on the server: ${list.join(', ')}` : undefined;
  };

  const shown = useMemo(() => {
    const visible = DEFS.filter(d =>
      (d.id !== 'strength' || !!w.inputImage)
      && (d.id !== 'quality' || quality.total > 0));
    return filterChips(visible, query);
  }, [query, w.inputImage, quality.total]);

  const sizePresets = (profile?.family === 'sd15' ? SD15_DIMENSION_PRESETS : DIMENSION_PRESETS).flatMap(g => g.items);
  const presetsFor = (id: ImageChipId): ChipPreset[] => {
    switch (id) {
      case 'size': return sizePresets.map(p => {
        const m = /^(\d+)x(\d+)$/.exec(p.value)!;
        const pw = Number(m[1]); const ph = Number(m[2]);
        return { label: p.label.replace(/ \((.+)\)$/, ' $1'), on: w.width === pw && w.height === ph, onPick: () => set({ width: pw, height: ph }) };
      });
      case 'batch': return nums(BATCH_PRESETS, w.batch, batch => set({ batch }), v => `×${v}`);
      case 'steps': return nums(STEP_PRESETS, w.steps, steps => set({ steps }));
      case 'cfg': return nums(CFG_PRESETS, w.cfg, cfg => set({ cfg }));
      case 'strength': return nums(STRENGTH_PRESETS, w.inputDenoise, inputDenoise => set({ inputDenoise }));
      case 'denoise': return nums(DENOISE_PRESETS, w.denoise, denoise => set({ denoise }));
      case 'clipSkip': return [-1, -2, -3].map(n => ({ label: n === -1 ? 'off' : String(n), on: (w.clipSkip ?? DEFAULT_CLIP_SKIP) === n, onPick: () => set({ clipSkip: n }) }));
      case 'sampling': return [
        ...SAMPLER_PICKS.filter(s => server.samplers.includes(s) || s === w.sampler).map(s => ({ label: s, on: w.sampler === s, onPick: () => set({ sampler: s }) })),
        ...SCHEDULER_PICKS.filter(s => server.schedulers.includes(s) || s === w.scheduler).map(s => ({ label: `· ${s}`, on: w.scheduler === s, onPick: () => set({ scheduler: s }) })),
      ];
      default: return [];
    }
  };

  const body = (id: ImageChipId) => {
    switch (id) {
      case 'checkpoint': return <CheckpointsField />;
      case 'vae': return <VaeField />;
      case 'loras': return <LorasField />;
      case 'embeddings': return <EmbeddingsField />;
      case 'size': return (
        <>
          <DimensionsField value={{ width: w.width, height: w.height }} onChange={({ width, height }) => set({ width, height })} presets={profile?.family === 'sd15' ? SD15_DIMENSION_PRESETS : undefined} />
          <TextEncoderField />
        </>
      );
      case 'batch': return <SliderField label="Images per run" value={w.batch} min={1} max={16} step={1} defaultValue={1} presets={[1, 2, 4, 8, 16]} onChange={batch => set({ batch })} />;
      case 'steps': return <SliderField label="Steps" value={w.steps} min={1} max={100} step={1} defaultValue={defaults.steps} onChange={steps => set({ steps })} ends={['Quicker, rougher', 'More detail, slower']} />;
      case 'cfg': return <SliderField label="CFG scale" value={w.cfg} min={1} max={20} step={0.5} defaultValue={defaults.cfg} onChange={cfg => set({ cfg })} ends={['Looser, softer colours', 'Follows the prompt, may burn']} />;
      case 'sampling': return (
        <>
          <SelectField label="Sampler" value={w.sampler} data={[...new Set([w.sampler, ...server.samplers])]} onChange={sampler => set({ sampler })} />
          <SelectField label="Scheduler" value={w.scheduler} data={[...new Set([w.scheduler, ...server.schedulers])]} onChange={scheduler => set({ scheduler })} />
        </>
      );
      case 'clipSkip': return <SelectField label="Clip skip" value={String(w.clipSkip ?? DEFAULT_CLIP_SKIP)} searchable={false} data={CLIP_SKIP_OPTIONS} onChange={v => set({ clipSkip: Number(v) })} description="-2 for Pony and most anime checkpoints; off for Flux and Z-Image." />;
      case 'denoise': return <SliderField label="Denoise (text to image)" value={w.denoise} min={0} max={1} step={0.05} defaultValue={1} onChange={denoise => set({ denoise })} ends={DENOISE_ENDS} description="Leave at 1 unless you know why; the img2img strength is its own chip." />;
      case 'input': return <InputImageSection />;
      case 'strength': return <SliderField label="Strength (img2img denoise)" value={w.inputDenoise} min={0} max={1} step={0.01} defaultValue={0.6} onChange={inputDenoise => set({ inputDenoise })} ends={DENOISE_ENDS} />;
      case 'loopback': return <EnhancementSettings />;
      case 'passes': return <PipelinePanel />;
      default: return null;
    }
  };
  const widthFor = (id: ImageChipId) => (id === 'checkpoint' || id === 'loras' || id === 'embeddings' || id === 'passes' || id === 'input' ? 440 : id === 'loopback' ? 400 : 340);

  return (
    <div className="flex flex-col gap-3">
      <TextInput size={large ? 'md' : 'xs'} value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Find a setting…" leftSection={<IconSearch size={14} />} aria-label="Find a setting" />
      {ROWS.map(row => {
        const chips = shown.filter(d => d.row === row);
        if (!chips.length) return null;
        return (
          <ChipRow key={row} title={row}>
            {chips.map(d => {
              const v = values[d.id];
              if (d.id === 'quality') {
                return <Chip key={d.id} label={d.label} value={v.value} changed={v.changed} large={large} onClick={() => setTagsOpen(true)} />;
              }
              return (
                <ChipPopover key={d.id} label={d.label} value={v.value} changed={v.changed} warn={warnFor(d.id)} presets={presetsFor(d.id)} width={widthFor(d.id)}>
                  {body(d.id)}
                </ChipPopover>
              );
            })}
          </ChipRow>
        );
      })}
      {shown.length === 0 && <Text size="xs" c="dimmed" ta="center" py="sm">No setting called “{query}”.</Text>}
      <div className="rounded-lg border border-border-default bg-bg-panel px-2 py-1"><PanelToolbar big={large} /></div>
      {tagsOpen && w.checkpoints[0] && <ModelProfileModal opened onClose={() => setTagsOpen(false)} fileName={w.checkpoints[0].name} />}
    </div>
  );
}
