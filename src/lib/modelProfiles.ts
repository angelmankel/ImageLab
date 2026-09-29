import type { Layer, WorkflowState } from './types';

/**
 * Model types ("profiles") and the graph families they run on.
 *
 * A *family* is how `buildGraph` wires the nodes. SD 1.5 and every SDXL-derived model (Pony,
 * Illustrious, NoobAI) share one graph; Flux, Anima and the like will each get their own.
 *
 * A *profile* is one model type as CivitAI labels it. It names its family, the settings a fresh
 * pick of that type starts from, the quality tags it expects in the prompt (shown as toggle pills,
 * never as editable text), and which LoRA / embedding types fit it.
 *
 * Defaults apply only when the base checkpoint's type changes, and only to values still at the
 * previous type's default — a value changed by hand is never overwritten (`profileTransition`).
 *
 * No runtime imports: the tests load this file on its own.
 */

export type GraphFamily = 'sd15' | 'sdxl';

export type ProfileId = 'SD 1.5' | 'SDXL' | 'Pony' | 'Illustrious' | 'NoobAI';

/** Settings a fresh pick of the type starts from. Unset fields are left alone. */
export type ProfileDefaults = Partial<Pick<WorkflowState,
  'width' | 'height' | 'steps' | 'cfg' | 'sampler' | 'scheduler' | 'clipSkip'>>;

export type ProfileTag = {
  /** Stable id: the key of its on/off in `workflow.profileTags`. */
  id: string;
  kind: 'positive' | 'negative';
  text: string;
  /** Off until the user turns it on. */
  offByDefault?: boolean;
  /** Heading its pill sits under in the model type window. */
  group?: string;
};

export type ModelProfile = {
  id: ProfileId;
  family: GraphFamily;
  defaults: ProfileDefaults;
  tags: ProfileTag[];
  /** Added after the positive quality tags when any is on — not a pill (Pony: `BREAK`). */
  separator?: string;
  /** Base-model buckets (see `BASE_MODEL_BUCKETS`) whose LoRAs and embeddings fit this type. */
  compatible: string[];
};

const tags = (kind: ProfileTag['kind'], words: string, off: string[] | true = [], group?: string): ProfileTag[] =>
  words.split(',').map((w) => w.trim()).filter(Boolean)
    .map((text) => ({
      id: `${kind[0]}:${text}`, kind, text,
      ...(off === true || off.includes(text) ? { offByDefault: true } : {}),
      ...(group ? { group } : {}),
    }));

const SDXL_SIZE = { width: 1024, height: 1024 };

export const MODEL_PROFILES: Record<ProfileId, ModelProfile> = {
  'SD 1.5': {
    id: 'SD 1.5', family: 'sd15',
    defaults: { width: 512, height: 512 },
    tags: [],
    compatible: ['SD 1.5'],
  },
  SDXL: {
    id: 'SDXL', family: 'sdxl',
    defaults: SDXL_SIZE,
    tags: [],
    compatible: ['SDXL'],
  },
  Pony: {
    id: 'Pony', family: 'sdxl',
    defaults: SDXL_SIZE,
    tags: [
      ...tags('positive', 'score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up', [], 'Quality'),
      ...tags('positive', 'source_anime, source_pony, source_furry, source_cartoon', true, 'Source'),
      ...tags('positive', 'rating_safe, rating_questionable, rating_explicit', true, 'Rating'),
      ...tags('negative', 'score_6, score_5, score_4'),
    ],
    // Ends the tag header so the subject starts a fresh CLIP chunk (see `applyBreaks`).
    separator: 'BREAK',
    compatible: ['Pony'],
  },
  Illustrious: {
    id: 'Illustrious', family: 'sdxl',
    defaults: SDXL_SIZE,
    tags: [
      ...tags('positive', 'masterpiece, best quality, amazing quality, very aesthetic, absurdres'),
      ...tags('negative', 'worst quality, low quality, lowres, jpeg artifacts, signature, watermark'),
    ],
    // NoobAI is trained on Illustrious; their LoRAs work on each other.
    compatible: ['Illustrious', 'NoobAI'],
  },
  NoobAI: {
    id: 'NoobAI', family: 'sdxl',
    defaults: SDXL_SIZE,
    tags: [
      ...tags('positive', 'masterpiece, best quality, newest, absurdres, highres, very awa', ['very awa']),
      ...tags('negative', 'worst quality, low quality, old, early, lowres, signature, username, logo'),
    ],
    compatible: ['NoobAI', 'Illustrious'],
  },
};

export const PROFILE_IDS = Object.keys(MODEL_PROFILES) as ProfileId[];

export function profileById(id: string | null | undefined): ModelProfile | null {
  return id && Object.prototype.hasOwnProperty.call(MODEL_PROFILES, id) ? MODEL_PROFILES[id as ProfileId] : null;
}

/** The profile for a base-model bucket, or null for a type with no profile yet (Flux, Other…). */
export function profileForBucket(bucket: string | null | undefined): ModelProfile | null {
  return profileById(bucket);
}

/** Guess from a file name when CivitAI does not know the file. Null when nothing matches. */
export function guessProfileFromName(fileName: string): ProfileId | null {
  const n = fileName.toLowerCase();
  if (/pony|pdxl|autismmix/.test(n)) return 'Pony';
  if (/noob/.test(n)) return 'NoobAI';
  if (/illustrious|illu[-_ ]|wai[-_ ]|hassaku/.test(n)) return 'Illustrious';
  if (/sd-?1\.?5|sd15/.test(n)) return 'SD 1.5';
  if (/sdxl|xl[-_ .]|[-_ ]xl/.test(n)) return 'SDXL';
  return null;
}

/**
 * The profile the base checkpoint should run as. `bucket` is its CivitAI base-model bucket
 * ('Unknown' when CivitAI has no entry); `pending` is true while that lookup is still running.
 * Returns `undefined` while pending, so a caller can wait instead of guessing too early.
 */
export function resolveProfile(
  fileName: string | undefined,
  bucket: string,
  pending: boolean,
  override?: string,
): ProfileId | null | undefined {
  if (!fileName) return null;
  if (override && profileById(override)) return override as ProfileId;
  const fromBucket = profileForBucket(bucket);
  if (fromBucket) return fromBucket.id;
  if (bucket !== 'Unknown') return null; // a known type with no profile yet (Flux, …)
  if (pending) return undefined;
  return guessProfileFromName(fileName);
}

/** The graph family for a workflow. Workflows with no known type run the SDXL graph, as before. */
export function workflowFamily(workflow: Pick<WorkflowState, 'modelProfile'>): GraphFamily {
  return profileById(workflow.modelProfile)?.family ?? 'sdxl';
}

/**
 * The workflow patch for a switch from type `from` to type `to`: `modelProfile` itself, plus each
 * default of `to` whose field still holds `from`'s default. With no `from`, the app's own starting
 * values count as untouched (`baseline`).
 */
export function profileTransition(
  workflow: WorkflowState,
  from: string | null | undefined,
  to: ProfileId | null,
  baseline: ProfileDefaults = SDXL_SIZE,
): Partial<WorkflowState> {
  const patch: Partial<WorkflowState> = { modelProfile: to ?? undefined };
  const next = profileById(to)?.defaults ?? {};
  const prev = profileById(from)?.defaults ?? baseline;
  const w = workflow as unknown as Record<string, unknown>;
  const p = patch as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  const o = prev as Record<string, unknown>;
  for (const key of Object.keys(n)) {
    if (n[key] === undefined) continue;
    if (w[key] === undefined || w[key] === o[key]) p[key] = n[key];
  }
  return patch;
}

export function profileTagOn(workflow: Pick<WorkflowState, 'profileTags'>, profile: ModelProfile, tag: ProfileTag): boolean {
  return workflow.profileTags?.[profile.id]?.[tag.id] ?? !tag.offByDefault;
}

/** The on/off map patch for one tag. */
export function withProfileTag(
  workflow: Pick<WorkflowState, 'profileTags'>, profile: ModelProfile, tag: ProfileTag, on: boolean,
): Partial<WorkflowState> {
  const all = workflow.profileTags ?? {};
  return { profileTags: { ...all, [profile.id]: { ...all[profile.id], [tag.id]: on } } };
}

/** The type's quality tags as prompt layers. They go in front: Pony's score tags must lead. */
export function profileTagLayers(workflow: Pick<WorkflowState, 'modelProfile' | 'profileTags'>): Layer[] {
  const profile = profileById(workflow.modelProfile);
  if (!profile) return [];
  const layers: Layer[] = profile.tags.map((t) => ({
    id: `profile:${t.id}`, kind: t.kind, on: profileTagOn(workflow, profile, t), weight: 1, tag: profile.id, text: t.text,
  }));
  if (profile.separator && layers.some((l) => l.kind === 'positive' && l.on)) {
    const last = layers.map((l) => l.kind).lastIndexOf('positive');
    layers.splice(last + 1, 0, { id: 'profile:separator', kind: 'positive', on: true, weight: 1, tag: profile.id, text: profile.separator });
  }
  return layers;
}

export function withProfileTags(layers: Layer[], workflow: Pick<WorkflowState, 'modelProfile' | 'profileTags'>): Layer[] {
  const extra = profileTagLayers(workflow);
  return extra.length ? [...extra, ...layers] : layers;
}

/** Every quality-tag text of the workflow's type, on or off: the pills own these words, so trigger
 *  words leave them out. */
export function profileTagTexts(workflow: Pick<WorkflowState, 'modelProfile'>): string[] {
  return profileById(workflow.modelProfile)?.tags.map((t) => t.text) ?? [];
}

/** Whether a LoRA / embedding of `bucket` fits the type. Unidentified files always show. */
export function bucketFits(profile: ModelProfile | null, bucket: string): boolean {
  return !profile || bucket === 'Unknown' || profile.compatible.includes(bucket);
}

/** Whether a VAE of `bucket` fits: VAEs follow the graph family, so any SDXL-type VAE fits Pony. */
export function vaeFits(profile: ModelProfile | null, bucket: string): boolean {
  if (!profile || bucket === 'Unknown') return true;
  const vaeProfile = profileForBucket(bucket);
  return !!vaeProfile && vaeProfile.family === profile.family;
}
