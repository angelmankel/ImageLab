import type { Layer, WorkflowEmbedding, WorkflowState } from './types';

/**
 * Embeddings (textual inversions) join the prompt as ComfyUI's `embedding:<name>` token, on the
 * side each one is set to — most published embeddings are negatives — followed by the
 * embedding's own trigger words, which have their own on/off and weight. Like model trigger words
 * they are not prompt layers: they are picked in the Models section and added at generate time.
 */

/** Names that look like a negative embedding start on the negative side. */
export function defaultEmbeddingTarget(name: string): WorkflowEmbedding['target'] {
  return /neg|bad|easynegative|unaesthetic|lowres|worst/i.test(name) ? 'negative' : 'positive';
}

/** An embedding's trigger words, cleaned: trimmed, no trailing commas, no case-blind repeats. */
export function embeddingWords(words: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (words ?? [])
    .map((w) => String(w ?? '').trim().replace(/,\s*$/, ''))
    .filter((w) => w && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
}

/**
 * Each embedding's token, then its trigger words (when it has any and they are on), both on the
 * embedding's side. A switched-off embedding adds neither.
 */
export function embeddingLayers(
  workflow: Pick<WorkflowState, 'embeddings'>,
  wordsFor: (name: string) => string[] | null | undefined = () => [],
): Layer[] {
  return (workflow.embeddings ?? []).filter((e) => e.name).flatMap((e) => {
    const token: Layer = { id: `embedding:${e.id}`, kind: e.target, on: e.on, weight: e.strength, tag: e.name, text: `embedding:${e.name}` };
    const words = embeddingWords(wordsFor(e.name));
    const ws = { on: true, weight: 1, ...e.words };
    if (!words.length) return [token];
    return [token, { id: `embedding-words:${e.id}`, kind: e.target, on: e.on && ws.on, weight: ws.weight, tag: e.name, text: words.join(', ') }];
  });
}

/** The prompt parts plus the embedding tokens and their trigger words, after them on their own side. */
export function withEmbeddings(
  layers: Layer[],
  workflow: Pick<WorkflowState, 'embeddings'>,
  wordsFor?: (name: string) => string[] | null | undefined,
): Layer[] {
  const extra = embeddingLayers(workflow, wordsFor);
  return extra.length ? [...layers, ...extra] : layers;
}
