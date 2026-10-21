/**
 * One line per step section for the phone's step page (mobile pass, m-create): the section rows
 * read "Prompt — a lighthouse on a cliff…", "Model — Juggernaut XL · 2 LoRAs" so the page says
 * what is set without opening each one. The Image step reads the main workflow; other kinds get
 * what their stores say cheaply, or nothing (the row then shows its name alone).
 */
import { useStore } from '@/lib/store';
import { shortModel, aspectLabel, fmtNum } from '@/lib/chips';
import type { Step } from '~/app/stepsStore';
import type { StepTab } from '~/screens/image/layoutStore';

export function useSectionSummary(step: Step, tab: StepTab): string {
  const image = step.kind === 'image';
  const prompt = useStore((s) => (image ? s.layers.filter((l) => l.kind === 'positive' && l.on).map((l) => l.text.trim()).filter(Boolean).join(', ') : ''));
  const w = useStore((s) => s.workflow);
  if (!image) return '';
  switch (tab) {
    case 'prompt': return prompt || 'Empty';
    case 'input': return `${w.width} × ${w.height} · ${aspectLabel(w.width, w.height)}${w.inputImage ? ' · input image' : ''}`;
    case 'model': {
      const loras = w.loras.filter((l) => l.on).length;
      return `${shortModel(w.checkpoints[0]?.name, 28)}${loras ? ` · ${loras} LoRA${loras > 1 ? 's' : ''}` : ''}`;
    }
    case 'settings': return `${w.steps} steps · CFG ${fmtNum(w.cfg)} · ${w.sampler}`;
    case 'style': {
      const n = (w.styleRefs ?? []).filter((r) => r.on !== false).length;
      return n ? `${n} reference${n > 1 ? 's' : ''}` : 'None';
    }
    default: return '';
  }
}
