import type { Layer, Snippet } from './types';

export function applyPromptPreset(current: Layer[], preset: Snippet, mode: 'insert' | 'replace', id: () => string): Layer[] {
  const parts = preset.layers ?? [{ kind: preset.kind, text: preset.text, tag: preset.tag, weight: preset.weight, on: true }];
  const fresh = parts.map(part => ({ ...part, id: id(), originSnippetId: preset.id }));
  if (mode === 'insert') return [...current, ...fresh];
  // A single saved negative never erases the positive prompt.
  return preset.layers ? fresh : [...current.filter(part => part.kind !== preset.kind), ...fresh];
}
