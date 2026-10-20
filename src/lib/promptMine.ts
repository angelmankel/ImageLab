/**
 * "Mine": the user's own whole prompts, image or video, saved from the prompt hub or made as a
 * set by the AI helper. Plain data and the list operations; the persisted store is
 * `features/next/mineStore.ts`. Imports nothing, so the tests load it from source.
 */

export type PromptKind = 'image' | 'video';

export interface MinePrompt {
  id: string;
  kind: PromptKind;
  name: string;
  positive: string;
  negative?: string;
  createdAt: number;
  /** The theme the set was made from, so a set reads as one group. */
  theme?: string;
}

/** A name from the first words of a prompt. */
export function nameFor(text: string, words = 5): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, words).join(' ') + (parts.length > words ? '…' : '');
}

const same = (a: MinePrompt, b: Pick<MinePrompt, 'kind' | 'positive' | 'negative'>) =>
  a.kind === b.kind && a.positive.trim() === b.positive.trim() && (a.negative ?? '').trim() === (b.negative ?? '').trim();

/** Add one, newest first; an identical prompt of the same kind is not saved twice. */
export function addMine(list: readonly MinePrompt[], p: MinePrompt): MinePrompt[] {
  if (!p.positive.trim()) return [...list];
  if (list.some(x => same(x, p))) return [...list];
  return [p, ...list];
}

export function removeMine(list: readonly MinePrompt[], id: string): MinePrompt[] {
  return list.filter(x => x.id !== id);
}

export function hasMine(list: readonly MinePrompt[], p: Pick<MinePrompt, 'kind' | 'positive' | 'negative'>): boolean {
  return list.some(x => same(x, p));
}

/** The prompts of one kind that match every word of the query, newest first. */
export function filterMine(list: readonly MinePrompt[], kind: PromptKind, query = ''): MinePrompt[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter(p => p.kind === kind)
    .filter(p => !terms.length || terms.every(t => `${p.name} ${p.positive} ${p.negative ?? ''} ${p.theme ?? ''}`.toLowerCase().includes(t)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * The AI's answer to "write N prompts" as a list: one per line, numbering, bullets and quotes
 * stripped, blank and tiny lines dropped, repeats removed. A line starting with "Prompt 3:" loses
 * that label too.
 */
export function parsePromptSet(raw: string, max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    let t = line.trim();
    t = t.replace(/^[\s\-\*•]+/, '').replace(/^\d+[\.\)\]:]\s*/, '').replace(/^prompt\s*\d*\s*[:\-]\s*/i, '').trim();
    t = t.replace(/^["“'`]+|["”'`]+$/g, '').trim();
    if (t.length < 8) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
