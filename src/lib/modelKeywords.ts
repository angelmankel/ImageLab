import type { Layer, WorkflowState } from './types';

/**
 * Model trigger words (CivitAI's `trainedWords`, "Trigger words" on the site): each chosen
 * checkpoint and LoRA adds its trigger words as a positive prompt part. They are not stored as
 * layers — the words come from the model's metadata at the time, so they cannot be edited or
 * removed. Only each model's on/off and weight are saved, in `workflow.modelKeywords`, keyed by
 * file name.
 */

export type ModelKeywordState = { on: boolean; weight: number };

export type ModelKeywordSource = {
  file: string;
  kind: 'checkpoint' | 'lora';
  words: string[];
  /** A LoRA switched off in the Models section adds nothing, whatever its keyword switch says. */
  active: boolean;
};

export const DEFAULT_MODEL_KEYWORD: ModelKeywordState = { on: true, weight: 1 };

/** Every chosen model with at least one trigger word, checkpoints first. */
export function modelKeywordSources(
  workflow: Pick<WorkflowState, 'checkpoints' | 'loras'>,
  wordsFor: (file: string) => string[] | null | undefined,
): ModelKeywordSource[] {
  const clean = (file: string) => {
    const seen = new Set<string>();
    return (wordsFor(file) ?? [])
      .map((w) => String(w ?? '').trim().replace(/,\s*$/, ''))
      .filter((w) => w && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
  };
  const out: ModelKeywordSource[] = [];
  const add = (file: string, kind: ModelKeywordSource['kind'], active: boolean) => {
    if (!file || out.some((s) => s.file === file)) return;
    const words = clean(file);
    if (words.length) out.push({ file, kind, words, active });
  };
  for (const c of workflow.checkpoints) add(c.name, 'checkpoint', true);
  for (const l of workflow.loras ?? []) add(l.name, 'lora', l.on);
  return out;
}

export function modelKeywordState(workflow: Pick<WorkflowState, 'modelKeywords'>, file: string): ModelKeywordState {
  return { ...DEFAULT_MODEL_KEYWORD, ...workflow.modelKeywords?.[file] };
}

/** The keyword parts as prompt layers, for compiling. Inactive LoRAs are left out. */
export function modelKeywordLayers(
  workflow: Pick<WorkflowState, 'checkpoints' | 'loras' | 'modelKeywords'>,
  wordsFor: (file: string) => string[] | null | undefined,
): Layer[] {
  return modelKeywordSources(workflow, wordsFor)
    .filter((s) => s.active)
    .map((s) => {
      const st = modelKeywordState(workflow, s.file);
      return { id: `model:${s.file}`, kind: 'positive', on: st.on, weight: st.weight, tag: s.file, text: s.words.join(', ') };
    });
}

/** The prompt parts plus the model keyword parts, which go after them. */
export function withModelKeywords(
  layers: Layer[],
  workflow: Pick<WorkflowState, 'checkpoints' | 'loras' | 'modelKeywords'>,
  wordsFor: (file: string) => string[] | null | undefined,
): Layer[] {
  const extra = modelKeywordLayers(workflow, wordsFor);
  return extra.length ? [...layers, ...extra] : layers;
}
