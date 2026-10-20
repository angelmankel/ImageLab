/**
 * "Use same models as step 1" (fix list item 40), the pure part. A step after step 1 follows the
 * Image step's models by default: every kind's entries (checkpoint, LoRAs, embeds, ControlNets,
 * VAE) mirror step 1's LIVE — until the user switches the step off the link, or un-links single
 * models and adjusts them one by one. `followOps` is the diff between what the step holds and
 * what step 1 says, as calls on the step's `KindApi`; applying it is idempotent (a second pass
 * yields nothing). Also `displayBadge`: the bubble / card badge with raw ComfyUI node names
 * hidden ("Load Checkpoint" on a checkpoint says nothing; a custom node title stays).
 * Imports nothing but pure siblings, so `tests/followStep.test.cjs` loads it from source.
 */
import type { ModelKind } from './kindSpecs';
import { baseName, sameFile } from './pendingLogic';

/** Step kinds whose models are their own business (a Video step's experts are not an SDXL checkpoint). */
export const NO_FOLLOW_STEP_KINDS: ReadonlySet<string> = new Set(['image', 'video']);

/** Can a step of this kind, at this position, follow step 1? */
export function canFollow(stepKind: string, stepIndex: number): boolean {
  return stepIndex > 0 && !NO_FOLLOW_STEP_KINDS.has(stepKind);
}

/** The key an un-linked entry is remembered by (the entry id is stable; its file is not). */
export const linkKey = (kind: ModelKind, entryId: string): string => `${kind}:${entryId}`;

// ── badges ─────────────────────────────────────────────────────────────────

const KIND_WORDS: Record<ModelKind, string[]> = {
  checkpoint: ['checkpoint', 'ckpt', 'model', 'diffusion model', 'unet'],
  lora: ['lora', 'lycoris', 'locon'],
  embedding: ['embedding', 'textual inversion', 'embed'],
  controlnet: ['controlnet', 'control net'],
  vae: ['vae'],
  clip: ['clip', 'text encoder', 'dual clip', 'triple clip', 'quad clip'],
  upscale: ['upscale model', 'upscaler', 'upscale'],
  other: [],
};

/** "Load Checkpoint" → "checkpoint"; "LoraLoaderModelOnly" → "lora"; "Style LoRA" → "style lora". */
function normaliseLabel(label: string): string {
  return label
    .replace(/([a-z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(load|loader|loaders|simple|model only|modelonly|advanced|node|from|file|with)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** True when a node title only restates the kind ("Load Checkpoint", "LoraLoader", "VAE Loader"). */
export function isRawNodeName(label: string, kind: ModelKind): boolean {
  const n = normaliseLabel(label);
  if (!n) return true;
  const words = KIND_WORDS[kind].map((w) => w.replace(/[^a-z0-9]+/g, ' ').trim());
  if (words.includes(n)) return true;
  // "checkpoint 2", "lora 1": the kind plus a counter.
  return words.some((w) => new RegExp(`^${w}( \\d+)?$`).test(n));
}

/**
 * The badge to show on a step's entry: a custom title as it is; a raw node name hidden — and,
 * when the kind has several slots, a slot number so the bubbles still tell apart.
 */
export function displayBadge(badge: string | undefined, kind: ModelKind, index: number, count: number): string | undefined {
  if (!badge) return undefined;
  if (!isRawNodeName(badge, kind)) return badge;
  return count > 1 ? `#${index + 1}` : undefined;
}

// ── the sync diff ──────────────────────────────────────────────────────────

/** What step 1 holds for a kind, in order. */
export interface SourceEntry { name: string; on: boolean; weight: number }

/** The target step's entries as the diff needs them. */
export interface TargetEntry { id: string; name: string; on: boolean; weight: number; linked: boolean; pending?: unknown }

export type FollowOp =
  | { op: 'rename'; id: string; name: string }
  | { op: 'add'; name: string; on: boolean; weight: number }
  | { op: 'remove'; id: string }
  | { op: 'setOn'; id: string; on: boolean }
  | { op: 'setWeight'; id: string; weight: number };

export interface FollowCaps {
  /** The step can add entries of this kind (else its slots are fixed and matched by position). */
  canAdd: boolean;
  canRemove: boolean;
  /** The kind has an On/Off switch (else `on` is not synced). */
  hasSwitch: boolean;
  /** The kind's weight is a strength that should follow (LoRA / embed / ControlNet); a merge ratio should not. */
  syncWeight: boolean;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function settle(e: TargetEntry, s: SourceEntry, caps: FollowCaps, out: FollowOp[]) {
  if (caps.hasSwitch && e.on !== s.on) out.push({ op: 'setOn', id: e.id, on: s.on });
  if (caps.syncWeight && !near(e.weight, s.weight)) out.push({ op: 'setWeight', id: e.id, weight: s.weight });
}

/**
 * The calls that make the linked entries of `kind` mirror `source`. Un-linked entries are never
 * touched and never counted. Fixed slots (no add): slot i ← source i, extra slots left as they
 * are, an empty source leaves everything alone; without a switch only the source's On entries count. Growable kinds: the linked set becomes exactly the
 * source set (by file name: a stray linked entry is renamed into a missing one before adding).
 */
export function followOps(kind: ModelKind, all: readonly SourceEntry[], entries: readonly TargetEntry[], caps: FollowCaps): FollowOp[] {
  const out: FollowOp[] = [];
  // A target without an On/Off switch takes only what step 1 has switched on (an off LoRA is not used there).
  const source = caps.hasSwitch ? all : all.filter((s) => s.on);
  const linked = entries.filter((e) => e.linked);
  if (!caps.canAdd) {
    linked.forEach((e, i) => {
      const s = source[i];
      if (!s) return;
      if (!sameFile(e.name, s.name, kind)) out.push({ op: 'rename', id: e.id, name: s.name });
      settle(e, s, caps, out);
    });
    return out;
  }
  const used = new Set<string>();
  const missing: SourceEntry[] = [];
  for (const s of source) {
    const e = linked.find((x) => !used.has(x.id) && sameFile(x.name, s.name, kind));
    if (e) { used.add(e.id); settle(e, s, caps, out); } else missing.push(s);
  }
  const strays = linked.filter((e) => !used.has(e.id));
  for (const s of missing) {
    const e = strays.shift();
    if (e) {
      out.push({ op: 'rename', id: e.id, name: s.name });
      settle(e, s, caps, out);
    } else {
      out.push({ op: 'add', name: s.name, on: s.on, weight: s.weight });
    }
  }
  if (caps.canRemove) for (const e of strays) out.push({ op: 'remove', id: e.id });
  return out;
}

/** A one-line signature of a source list, to re-run the sync only when step 1 really changed. */
export function sourceKey(source: readonly SourceEntry[]): string {
  return source.map((s) => `${baseName(s.name).toLowerCase()}|${s.on ? 1 : 0}|${s.weight}`).join(';');
}

/**
 * The file step 1 says each linked FIXED slot should hold (slot i ← the i-th source entry; without
 * a switch only On entries count). The UI shows a slot whose file differs after the sync as
 * "step 1's model is not offered here". Growable kinds always end up matching: empty map.
 */
export function fixedExpect(all: readonly SourceEntry[], entries: readonly TargetEntry[], caps: FollowCaps): Record<string, string> {
  if (caps.canAdd) return {};
  const source = caps.hasSwitch ? all : all.filter((s) => s.on);
  const out: Record<string, string> = {};
  entries.filter((e) => e.linked).forEach((e, i) => { if (source[i]) out[e.id] = source[i].name; });
  return out;
}
