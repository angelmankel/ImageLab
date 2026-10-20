/**
 * Trigger words in the prompt (rule 4: trigger words are tap-to-add chips, ✓ when already in the
 * prompt). The prompt is one comma-separated text; a word is "in" when one of its parts equals the
 * word, ignoring case and any `(word:1.2)` weight wrapper. Pure, imports nothing, tested in
 * `tests/promptWords.test.cjs`.
 */

/** The prompt's comma parts, trimmed, weight wrappers removed, empties dropped. */
export function promptParts(text: string): string[] {
  return (text ?? '').split(',').map(bareWord).filter(Boolean);
}

/** `(masterpiece:1.2)` → `masterpiece`; `[word]` → `word`; otherwise trimmed. */
export function bareWord(part: string): string {
  let s = (part ?? '').trim();
  const m = s.match(/^\(\s*(.*?)\s*(?::\s*[\d.]+\s*)?\)$/);
  if (m) s = m[1].trim();
  const b = s.match(/^\[\s*(.*?)\s*\]$/);
  if (b) s = b[1].trim();
  return s;
}

const key = (w: string) => bareWord(w).toLowerCase().replace(/\s+/g, ' ');

export function hasWord(text: string, word: string): boolean {
  const k = key(word);
  if (!k) return false;
  return promptParts(text).some((p) => p.toLowerCase().replace(/\s+/g, ' ') === k);
}

/** The prompt with `word` appended as a new part (unchanged when it is there already). */
export function addWord(text: string, word: string): string {
  const w = word.trim();
  if (!w || hasWord(text, w)) return text;
  const base = (text ?? '').trim().replace(/[,\s]+$/, '');
  return base ? `${base}, ${w}` : w;
}

/** The prompt without `word` (every part that equals it, weight wrappers included). */
export function removeWord(text: string, word: string): string {
  const k = key(word);
  if (!k) return text;
  const parts = (text ?? '').split(',').map((p) => p.trim());
  const kept = parts.filter((p) => p && key(p) !== k);
  return kept.join(', ');
}

export function toggleWord(text: string, word: string): string {
  return hasWord(text, word) ? removeWord(text, word) : addWord(text, word);
}
