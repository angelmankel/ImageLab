/** Collapsible model and source-image controls for the generation workspace. */
import { useStore } from '@/lib/store';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModelStack } from '@/features/models';
import { InputImageSection } from '@/features/inputImage';
import { ControlSection } from './ControlSection';

/** Just the filename, so a summary is readable at a glance. */
const shortName = (f: string) => f.replace(/\.(safetensors|ckpt|pt|pth|bin)$/i, '').replace(/^.*[\\/]/, '');

export function ModelsSection() {
  const workflow = useStore(s => s.workflow);

  const base = workflow.checkpoints[0]?.name;
  const parts = [
    base ? shortName(base) : 'no checkpoint',
    workflow.checkpoints.length > 1 ? `+${workflow.checkpoints.length - 1} merged` : null,
    workflow.vae ? shortName(workflow.vae) : null,
    workflow.loras.length ? `${workflow.loras.length} LoRA${workflow.loras.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <ControlSection id="models" title="Models" defaultCollapsed summary={parts.join(' · ')}>
      <ErrorBoundary label="Models"><ModelStack /></ErrorBoundary>
    </ControlSection>
  );
}

export function InputImageControlSection() {
  const workflow = useStore(s => s.workflow);

  const img = workflow.inputImage;
  return (
    <ControlSection
      id="inputimage"
      title="Input image"
      summary={img ? `${img.width} × ${img.height} · img2img on` : 'none · txt2img'}
      // Nothing is set and nothing is being searched for: this is the one section that is usually
      // irrelevant, so it starts folded. The summary still says so, and one tap opens it.
      defaultCollapsed={!img}
    >
      <ErrorBoundary label="Input image"><InputImageSection /></ErrorBoundary>
    </ControlSection>
  );
}
