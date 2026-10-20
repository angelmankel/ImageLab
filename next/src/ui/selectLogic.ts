/**
 * The searchable select's pure part (item 38): rank options against what was typed, split a label
 * into matched / unmatched pieces for the highlight, and the sampler families used as groups.
 * Imports nothing (tests/select.test.cjs).
 */

export interface SelectOption { value: string; label?: string; description?: string; group?: string }

const norm = (s: string) => s.toLowerCase();

/**
 * How well `label` matches `q` (lower = better), or -1 for no match:
 *   0 exact · 1 prefix · 2 a word starts with it (after _ - . space /) · 3 contains it ·
 *   4 every typed letter in order (euanc → euler_ancestral).
 */
export function matchRank(label: string, q: string): number {
  const l = norm(label);
  const t = norm(q.trim());
  if (!t) return 0;
  if (l === t) return 0;
  if (l.startsWith(t)) return 1;
  const at = l.indexOf(t);
  if (at > 0 && /[\s_\-./(]/.test(l[at - 1])) return 2;
  if (at >= 0) {
    // A later word-start hit beats a mid-word one even when a mid-word one comes first.
    const re = /[\s_\-./(]/g;
    for (let m = re.exec(l); m; m = re.exec(l)) if (l.startsWith(t, m.index + 1)) return 2;
    return 3;
  }
  let i = 0;
  for (const ch of l) if (ch === t[i]) i++;
  return i === t.length ? 4 : -1;
}

/** The options that match, best first (stable within a rank). Empty query → all, in order. */
export function filterOptions<O extends SelectOption>(options: readonly O[], q: string): O[] {
  if (!q.trim()) return [...options];
  return options
    .map((o, i) => ({ o, i, r: matchRank(o.label ?? o.value, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.o);
}

/**
 * The label in pieces for the highlight: the contiguous hit when there is one (word-start hits
 * first), else each letter of an in-order match.
 */
export function splitMatch(label: string, q: string): Array<{ text: string; hit: boolean }> {
  const t = norm(q.trim());
  if (!t) return [{ text: label, hit: false }];
  const l = norm(label);
  let at = -1;
  if (l.startsWith(t)) at = 0;
  if (at < 0) {
    const re = /[\s_\-./(]/g;
    for (let m = re.exec(l); m && at < 0; m = re.exec(l)) if (l.startsWith(t, m.index + 1)) at = m.index + 1;
  }
  if (at < 0) at = l.indexOf(t);
  if (at >= 0) {
    return [
      { text: label.slice(0, at), hit: false },
      { text: label.slice(at, at + t.length), hit: true },
      { text: label.slice(at + t.length), hit: false },
    ].filter((p) => p.text);
  }
  const out: Array<{ text: string; hit: boolean }> = [];
  let i = 0;
  for (let k = 0; k < label.length; k++) {
    const hit = i < t.length && l[k] === t[i];
    if (hit) i++;
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += label[k];
    else out.push({ text: label[k], hit });
  }
  return i === t.length ? out : [{ text: label, hit: false }];
}

/** Options in groups, groups in first-seen order; options without a group come first. */
export function groupOptions<O extends SelectOption>(options: readonly O[]): Array<{ group: string; items: O[] }> {
  const out: Array<{ group: string; items: O[] }> = [];
  for (const o of options) {
    const g = o.group ?? '';
    const hit = out.find((x) => x.group === g);
    if (hit) hit.items.push(o);
    else if (g === '') out.unshift({ group: g, items: [o] });
    else out.push({ group: g, items: [o] });
  }
  return out;
}

/** The family of a ComfyUI sampler name (the Sampler picker's groups). */
export function samplerFamily(name: string): string {
  const n = norm(name);
  if (n.startsWith('euler')) return 'Euler';
  if (n.startsWith('dpmpp') || n.startsWith('dpm_') || n === 'dpm_fast' || n === 'dpm_adaptive') return 'DPM';
  if (n.startsWith('heun') || n.startsWith('exp_heun')) return 'Heun';
  if (n.startsWith('res_') || n.startsWith('res')) return 'RES';
  if (n.startsWith('uni_pc') || n.startsWith('deis') || n.startsWith('ipndm') || n.startsWith('gradient')) return 'Multistep';
  if (n.startsWith('lcm') || n.startsWith('tcd') || n.includes('lightning')) return 'Few-step';
  if (n.startsWith('ddim') || n.startsWith('ddpm') || n.startsWith('lms') || n.startsWith('sa_solver') || n.startsWith('seeds')) return 'Classic';
  return 'Other';
}

/** Short words per sampler family (shown under the group's options). */
export const SAMPLER_NOTES: Readonly<Record<string, string>> = {
  euler: 'fast, clean', euler_ancestral: 'adds variety each step', dpmpp_2m: 'sharp all-rounder', dpmpp_2m_sde: 'more detail, a little grain',
  dpmpp_sde: 'detailed, slower', dpmpp_3m_sde: 'fine detail at high steps', heun: 'accurate, 2× slower', lcm: 'for LCM models (4–8 steps)',
  uni_pc: 'good at low steps', ddim: 'classic, steady', lms: 'classic, smooth', res_multistep: 'for Flux / SD3-class models',
};
