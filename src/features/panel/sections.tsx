/**
 * The panel's sections — what each one renders, its name and icon, and a live status (a one-line
 * summary plus an optional badge) for the tab bar and section headings. The sections themselves
 * are the same controls the accordion held; only the frame around them changed.
 */
import { useMemo, type ReactNode } from 'react';
import {
  IconAdjustments, IconArrowsMaximize, IconBolt, IconBookmark, IconBox, IconBrush, IconCamera, IconFlame,
  IconHeart, IconLayoutGrid, IconMessageCircle, IconPalette, IconPhoto, IconPhotoUp, IconSparkles, IconStar,
  IconWand, type Icon as TablerIcon,
} from '@tabler/icons-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModelFields } from '@/components/models/ModelFields';
import { PromptFields } from '@/features/layers/PromptFields';
import { InputImageSection } from '@/features/inputImage';
import { GenerationSettings, CompositionSettings, EnhancementSettings } from '@/features/controls/GenerationSettings';
import { PipelinePanel } from '@/features/controls/PipelinePanel';
import { useStore } from '@/lib/store';
import { DEFAULT_LOOPBACK, listedPasses, loopbackSizes } from '@/lib/pipeline';
import { missingResources } from '@/lib/routing';
import { SECTION_IDS, type SectionId } from '@/lib/panelTabs';

/** What the panel is editing right now: the generate workflow, or one canvas layer. */
export interface PanelScope {
  layerScope: boolean;
  /** The canvas layer is an inpaint: no whole-image refinement. */
  inpaint: boolean;
  showDenoise: boolean;
  /** The canvas layer's size, which the base image renders at in layer scope. */
  size?: { width: number; height: number };
}

export const SECTION_META: Record<SectionId, { title: string; icon: TablerIcon }> = {
  prompts: { title: 'Prompts', icon: IconMessageCircle },
  models: { title: 'Models', icon: IconBox },
  parameters: { title: 'Parameters', icon: IconAdjustments },
  composition: { title: 'Composition', icon: IconPhoto },
  enhancement: { title: 'Enhancement', icon: IconSparkles },
  input: { title: 'Input image', icon: IconPhotoUp },
  passes: { title: 'Passes', icon: IconArrowsMaximize },
};

/** Icons a tab can wear. The first six are the built-in tabs'. */
export const TAB_ICONS: Record<string, TablerIcon> = {
  prompt: IconMessageCircle, models: IconBox, settings: IconAdjustments, enhance: IconSparkles,
  input: IconPhotoUp, passes: IconArrowsMaximize,
  star: IconStar, heart: IconHeart, bolt: IconBolt, flame: IconFlame, bookmark: IconBookmark,
  palette: IconPalette, wand: IconWand, brush: IconBrush, camera: IconCamera, grid: IconLayoutGrid,
};

export const tabIcon = (key: string): TablerIcon => TAB_ICONS[key] ?? IconStar;

/** Canvas layers bring their own size and image, so Composition and Input do not apply there. */
export function availableSections(scope: PanelScope): SectionId[] {
  return SECTION_IDS.filter(s => !scope.layerScope || (s !== 'composition' && s !== 'input'));
}

export function SectionBody({ id, scope }: { id: SectionId; scope: PanelScope }): ReactNode {
  switch (id) {
    case 'prompts': return <ErrorBoundary label="Prompts"><PromptFields /></ErrorBoundary>;
    case 'models': return <ErrorBoundary label="Models"><ModelFields /></ErrorBoundary>;
    case 'parameters': return <GenerationSettings layerScope={scope.layerScope} showDenoise={scope.showDenoise} />;
    case 'composition': return <CompositionSettings />;
    case 'enhancement': return <EnhancementSettings disabled={scope.inpaint} size={scope.size} />;
    case 'input': return <ErrorBoundary label="Input image"><InputImageSection /></ErrorBoundary>;
    case 'passes': return <ErrorBoundary label="Passes"><PipelinePanel inpaintMode={scope.inpaint} /></ErrorBoundary>;
  }
}

export interface SectionStatus {
  summary: string;
  /** A few characters on the tab: a count, "on", "img"… */
  badge?: string;
  /** `warn` means something will stop or spoil the run. */
  tone?: 'accent' | 'warn';
  /** Why the badge is there, for its tooltip. */
  note?: string;
}

/** Just the filename, so a summary is readable at a glance. */
export const shortName = (f: string) => f.replace(/\.(safetensors|ckpt|pt|pth|bin|sft|gguf)$/i, '').replace(/^.*[\\/]/, '');

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Every section's status, recomputed when the workflow, prompt parts or server lists change. */
export function useSectionStatus(scope: PanelScope): Record<SectionId, SectionStatus> {
  const workflow = useStore(s => s.workflow);
  const layers = useStore(s => s.layers);
  const server = useStore(s => s.server);
  const online = useStore(s => Object.keys(s.serverInfo).length > 0);
  const { layerScope, inpaint, showDenoise, size } = scope;
  const width = size?.width ?? workflow.width;
  const height = size?.height ?? workflow.height;

  return useMemo(() => {
    const w = workflow;
    // Only a connected server can say a model is missing; offline, the lists are empty or fallbacks.
    const missing = online ? missingResources(w, server) : [];
    const missingModels = missing.filter(m => /^(checkpoint|VAE|LoRA|embedding) /.test(m));
    const missingSettings = missing.filter(m => /^(sampler|scheduler) /.test(m));
    const missingPasses = missing.filter(m => m.startsWith('Pass '));
    const warn = (list: string[]): Pick<SectionStatus, 'badge' | 'tone' | 'note'> =>
      ({ badge: '!', tone: 'warn', note: `Not on the server: ${list.join(', ')}` });

    const first = layers.find(l => l.kind === 'positive' && l.on && l.text.trim())?.text.trim() ?? '';
    const parts = layers.filter(l => l.on && l.text.trim()).length;

    const base = w.checkpoints[0]?.name;
    const loras = w.loras.filter(l => l.on).length;
    const embeddings = (w.embeddings ?? []).filter(e => e.on).length;
    const extras = loras + embeddings;

    const loopback = w.loopback ?? DEFAULT_LOOPBACK;
    const final = loopbackSizes(loopback, width, height).at(-1);
    const passes = listedPasses(w).filter(p => p.on !== false && !(inpaint && (!p.kind || p.kind === 'sample'))).length;

    return {
      prompts: {
        summary: first ? `${first.slice(0, 40)}${first.length > 40 ? '…' : ''}${parts > 1 ? ` · ${parts} parts` : ''}` : 'Empty',
      },
      models: {
        summary: [
          base ? shortName(base) : 'no checkpoint',
          w.checkpoints.length > 1 ? `+${w.checkpoints.length - 1} merged` : null,
          w.vae ? shortName(w.vae) : null,
          loras ? plural(loras, 'LoRA') : null,
          embeddings ? plural(embeddings, 'embedding') : null,
        ].filter(Boolean).join(' · '),
        ...(!base ? { badge: '!', tone: 'warn' as const, note: 'No checkpoint chosen' }
          : missingModels.length ? warn(missingModels)
            : extras ? { badge: String(extras), note: [loras && plural(loras, 'LoRA'), embeddings && plural(embeddings, 'embedding')].filter(Boolean).join(', ') + ' on' } : {}),
      },
      parameters: {
        summary: `${w.sampler} · ${w.steps} steps · CFG ${w.cfg}${showDenoise ? ` · denoise ${layerScope ? w.inputDenoise : w.denoise}` : ''}`,
        ...(missingSettings.length ? warn(missingSettings) : {}),
      },
      composition: {
        summary: `${w.width} × ${w.height}${w.batch > 1 ? ` · ×${w.batch}` : ''}`,
        ...(w.batch > 1 ? { badge: `×${w.batch}`, note: `${w.batch} images per run` } : {}),
      },
      enhancement: {
        summary: loopback.enabled && final
          ? `Loopback ×${loopback.iterations} → ${final[0]} × ${final[1]}${loopback.autoDenoise ? ` · denoise ${(loopback.denoiseStart ?? 0.6).toFixed(2)}→${(loopback.denoiseEnd ?? 0.3).toFixed(2)}` : ''}`
          : 'Loopback off',
        ...(loopback.enabled && !inpaint ? { badge: `×${loopback.iterations}`, tone: 'accent' as const, note: `Loopback on: ${loopback.iterations} rounds` } : {}),
      },
      input: {
        summary: w.inputImage ? `${w.inputImage.width} × ${w.inputImage.height} · img2img on` : 'none · txt2img',
        ...(w.inputImage && !layerScope ? { badge: 'img', tone: 'accent' as const, note: 'img2img: an input image is loaded' } : {}),
      },
      passes: {
        summary: `${passes} after base image`,
        ...(missingPasses.length ? warn(missingPasses)
          : passes ? { badge: String(passes), note: `${plural(passes, 'pass')} after the base image` } : {}),
      },
    };
  }, [workflow, layers, server, online, layerScope, inpaint, showDenoise, width, height]);
}
