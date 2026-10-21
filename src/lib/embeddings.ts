import type { Layer, WorkflowEmbedding, WorkflowState } from './types';

/**
 * Embeddings (textual inversions) join the prompt as ComfyUI's `embedding:<name>` token, on the
 * side each one is set to — most published embeddings are negatives. ONE weight: the embedding's
 * strength (fix list 2 item 32, Donny picked option 1). Only the `embedding:` token loads the
 * embedding in ComfyUI; its CivitAI "trigger word" is usually just its own name, which as plain
 * text does nothing useful. So trigger words are NOT added by default: an embedding whose words
 * differ from its name offers "Also add trigger words" (`addWords`), and those words then follow
 * the token on the same side at the same strength. Like model trigger words they are not prompt
 * layers: they are picked in the Models section and added at generate time.
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

/** "Stable_Yogis-Positives_v1.5" → "stableyogispositives": no case, separators or version tail. */
function nameKey(s: string): string {
  return s.replace(/\.(safetensors|pt|bin|ckpt)$/i, '').replace(/^embedding:/i, '').replace(/[-_ .]*v?\d+(\.\d+)*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * The trigger words worth adding as text: the cleaned words minus the ones that are just the
 * embedding's own name (with or without separators / a version tail). Empty = nothing to offer.
 */
export function embeddingExtraWords(name: string, words: string[] | null | undefined): string[] {
  const own = nameKey(name);
  return embeddingWords(words).filter((w) => {
    const k = nameKey(w);
    return k && k !== own;
  });
}

/**
 * Each embedding's token, then — only when "Also add trigger words" is on and it has words other
 * than its own name — those words, both on the embedding's side at its one strength. A
 * switched-off embedding adds neither.
 */
export function embeddingLayers(
  workflow: Pick<WorkflowState, 'embeddings'>,
  wordsFor: (name: string) => string[] | null | undefined = () => [],
): Layer[] {
  return (workflow.embeddings ?? []).filter((e) => e.name).flatMap((e) => {
    const token: Layer = { id: `embedding:${e.id}`, kind: e.target, on: e.on, weight: e.strength, tag: e.name, text: `embedding:${e.name}` };
    if (!e.addWords) return [token];
    const words = embeddingExtraWords(e.name, wordsFor(e.name));
    if (!words.length) return [token];
    return [token, { id: `embedding-words:${e.id}`, kind: e.target, on: e.on, weight: e.strength, tag: e.name, text: words.join(', ') }];
  });
}

/** The prompt parts plus the embedding tokens (and opted-in trigger words), after them on their own side. */
export function withEmbeddings(
  layers: Layer[],
  workflow: Pick<WorkflowState, 'embeddings'>,
  wordsFor?: (name: string) => string[] | null | undefined,
): Layer[] {
  const extra = embeddingLayers(workflow, wordsFor);
  return extra.length ? [...layers, ...extra] : layers;
}
