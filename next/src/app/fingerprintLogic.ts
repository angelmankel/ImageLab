/**
 * Item 17 (stale steps), the pure part: tested in tests/fingerprint.test.cjs, no imports.
 *
 * A step's settings + inputs flatten into a `Snap` (readable key → short value string). Its
 * fingerprint is a hash of that snap. Every output stores the fingerprint (and the snap) of the
 * settings that made it, so the rail can tell:
 *   fresh  ✓  the newest output matches the settings as they are now,
 *   stale  ↻  it does not (this step changed, its input changed, or a step above it is stale and
 *             this step follows it), and say what changed ("CFG 4.5 → 6"),
 *   none      no output yet.
 * "Generate all" re-runs only the steps that are not fresh (our own cache, works for any provider).
 */

/** Flattened settings: key path → value as a short string (long strings become `#<hash>`). */
export type Snap = Record<string, string>;

export type Freshness = 'none' | 'fresh' | 'stale';

/** cyrb53: a fast 53-bit string hash, as base36. */
export function hashStr(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Strings longer than this are stored as a hash (prompts, data URLs): the diff then says "edited". */
const LONG = 60;

/** Hashes of the last long strings seen (an input picture's data URL is hashed once, not on every slider move). */
const longCache = new Map<string, string>();
function longHash(s: string): string {
  let h = longCache.get(s);
  if (h === undefined) {
    h = hashStr(s);
    longCache.set(s, h);
    if (longCache.size > 32) longCache.delete(longCache.keys().next().value as string);
  }
  return h;
}

/** Arrays whose items are keyed by their `name` (so a re-order is not a change, and the diff names them). */
const BY_NAME = new Set(['loras', 'embeddings', 'h3.loras']);

/** Flatten any JSON-ish value into `out`. Functions and undefined / null are skipped. */
export function flatten(value: unknown, prefix = '', out: Snap = {}): Snap {
  if (value === undefined || value === null || typeof value === 'function') return out;
  if (typeof value !== 'object') {
    const s = String(value);
    out[prefix] = s.length > LONG ? `#${longHash(s)}` : s;
    return out;
  }
  if (Array.isArray(value)) {
    const named = BY_NAME.has(prefix) && value.every((v) => v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string');
    value.forEach((v, i) => {
      if (named) {
        const { name, id: _id, ...rest } = v as { name: string; id?: unknown };
        flatten(rest, `${prefix}[${name}]`, out);
      } else flatten(v, prefix ? `${prefix}.${i}` : String(i), out);
    });
    return out;
  }
  for (const k of Object.keys(value as object).sort()) flatten((value as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** The fingerprint of a snap (order of keys does not matter). */
export function fingerprintOf(snap: Snap): string {
  return hashStr(Object.keys(snap).sort().map((k) => `${k}=${snap[k]}`).join('\n'));
}

const isSeedKey = (k: string) => /seed/i.test(k);

/**
 * The snap of a run's output: what was sent at queue time (`sent`), with the seeds as they are
 * now (`now`) — a run may re-roll its seeds while it is queued and write them back.
 */
export function withSeedsFrom(sent: Snap, now: Snap): Snap {
  const out: Snap = {};
  for (const [k, v] of Object.entries(sent)) if (!isSeedKey(k)) out[k] = v;
  for (const [k, v] of Object.entries(now)) if (isSeedKey(k)) out[k] = v;
  return out;
}

const LABELS: Record<string, string> = {
  seed: 'Seed', steps: 'Steps', cfg: 'CFG', sampler: 'Sampler', scheduler: 'Scheduler', denoise: 'Denoise',
  width: 'Width', height: 'Height', batch: 'Batch', vae: 'VAE', clipSkip: 'CLIP skip', textEncoder: 'Text encoder',
  'prompt.positive': 'Prompt', 'prompt.negative': 'Negative prompt', positive: 'Prompt', negative: 'Negative prompt',
  input: 'Input picture', inputImage: 'Input picture', 'inputImage.dataUrl': 'Input picture', inputDenoise: 'Input denoise',
  'checkpoints.0.name': 'Model', model: 'Model', models: 'Models', iterations: 'Rounds', upscale: 'Growth', factor: 'Factor',
  refine: 'Refine after upscale', autoDenoise: 'Auto denoise', denoiseStart: 'Denoise start', denoiseEnd: 'Denoise end',
  workflow: 'Workflow', modified: 'Workflow file', frames: 'Frames', fps: 'FPS', startImage: 'Start frame', endImage: 'End frame',
  weight: 'weight', strength: 'strength', on: 'on', 'upscale.model': 'Upscale model', 'removeBg.model': 'Background model',
};

/** Per-kind settings sit under these keys on the snap; the label is the setting alone. */
const KIND_PREFIX: Record<string, true> = { refine: true, upscale: true, removeBg: true };

const humanize = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const stripExt = (n: string) => n.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf)$/i, '');

/** A readable label for a snap key ("cfg" → "CFG", "loras[detail.safetensors].weight" → "LoRA detail weight"). */
export function labelOf(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const named = /^(.*?)\[(.+)\](?:\.(.+))?$/.exec(key);
  if (named) {
    const what = named[1].endsWith('loras') ? 'LoRA' : named[1].endsWith('embeddings') ? 'Embedding' : humanize(named[1]);
    const leaf = named[3] ? ` ${LABELS[named[3]] ?? humanize(named[3]).toLowerCase()}` : '';
    return `${what} ${stripExt(named[2])}${leaf}`;
  }
  const parts = key.split('.');
  if (parts[0] === 'values') return `${parts.slice(1).join(' ')}`;
  // Style tab references: "Style reference 1 picture", "Style reference 2 weight".
  if (parts[0] === 'styleRefs' && parts.length > 2) {
    const what = parts[2] === 'images' ? 'picture' : parts[2] === 'weight' ? 'strength' : LABELS[parts[2]] ?? humanize(parts[2]).toLowerCase();
    return `Style reference ${Number(parts[1]) + 1} ${what}`;
  }
  const leaf = parts[parts.length - 1];
  if (parts[0] in KIND_PREFIX && parts.length > 1) return LABELS[parts.slice(1).join('.')] ?? LABELS[leaf] ?? humanize(leaf);
  return LABELS[leaf] ?? humanize(leaf);
}

const shown = (v: string | undefined) => (v === undefined ? '—' : v.length > 24 ? `${v.slice(0, 22)}…` : v);

/**
 * What changed from `before` to `now`, one short line each ("CFG 4.5 → 6", "Prompt edited",
 * "LoRA detail added"), at most `max` lines plus "+ N more".
 */
export function diffSnaps(before: Snap, now: Snap, max = 3): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(now)])].filter((k) => before[k] !== now[k]).sort();
  const lines: string[] = [];
  const seenItems = new Set<string>();
  for (const k of keys) {
    const item = /^(.*?\[.+\])(?:\.|$)/.exec(k)?.[1];
    if (item) {
      const inBefore = Object.keys(before).some((x) => x === item || x.startsWith(`${item}.`));
      const inNow = Object.keys(now).some((x) => x === item || x.startsWith(`${item}.`));
      if (!inBefore || !inNow) {
        if (seenItems.has(item)) continue;
        seenItems.add(item);
        lines.push(`${labelOf(item)} ${inNow ? 'added' : 'removed'}`);
        continue;
      }
    }
    const label = labelOf(k);
    const a = before[k];
    const b = now[k];
    if (k === 'input' || k.startsWith('inputImage')) { if (!lines.includes('New input picture')) lines.push('New input picture'); continue; }
    if (a?.startsWith('#') || b?.startsWith('#')) { lines.push(`${label} edited`); continue; }
    lines.push(`${label} ${shown(a)} → ${shown(b)}`);
  }
  const uniq = [...new Set(lines)];
  return uniq.length > max ? [...uniq.slice(0, max), `+ ${uniq.length - max} more`] : uniq;
}

/** What the chain rule needs to know about one step. */
export interface StepFact {
  id: string;
  /** The step has an output of its own. */
  hasOutput: boolean;
  /** The fingerprint its newest output was made with; undefined = unknown (made before fingerprints existed). */
  outFp?: string;
  /** The fingerprint of its settings + input now. */
  nowFp: string;
  /** It takes the step above's NEWEST output (chained, Auto): a stale step above makes it stale too. */
  followsAbove: boolean;
}

export interface StepFreshness {
  state: Freshness;
  /** Why it is stale: its own settings / input ('own'), or the step above it ('above'). */
  reason: 'own' | 'above' | null;
}

/** The freshness of every step of a chain, in order. Stale spreads down to the steps that follow. */
export function chainFreshness(facts: readonly StepFact[]): StepFreshness[] {
  const out: StepFreshness[] = [];
  facts.forEach((f, i) => {
    if (!f.hasOutput) { out.push({ state: 'none', reason: null }); return; }
    if (f.outFp !== undefined && f.outFp !== f.nowFp) { out.push({ state: 'stale', reason: 'own' }); return; }
    if (i > 0 && f.followsAbove && out[i - 1].state === 'stale') { out.push({ state: 'stale', reason: 'above' }); return; }
    out.push({ state: 'fresh', reason: null });
  });
  return out;
}
