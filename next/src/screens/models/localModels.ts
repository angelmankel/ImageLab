/**
 * Installed files CivitAI does not know (not hashed yet, hash lookup pending / failed, or simply
 * not on CivitAI) still belong in the Downloaded list (Donny, 10-20: "some models I remember just
 * aren't there anymore"). Each becomes a local model-shaped item with a NEGATIVE id, one version,
 * one file (the server's name), no pictures. Pure: tested in tests/localModels.test.cjs.
 */
import type { CivitaiModel } from '@/lib/civitai';

export type LocalKind = 'checkpoint' | 'vae' | 'lora' | 'embedding' | 'upscale' | 'controlnet';

/** Which `ServerInfo` list holds each kind, and the CivitAI type the picker filters by. */
export const LOCAL_LISTS: readonly { kind: LocalKind; list: 'models' | 'vaes' | 'loras' | 'embeddings' | 'upscaleModels' | 'controlnets'; type: string }[] = [
  { kind: 'checkpoint', list: 'models', type: 'Checkpoint' },
  { kind: 'vae', list: 'vaes', type: 'VAE' },
  { kind: 'lora', list: 'loras', type: 'LORA' },
  { kind: 'embedding', list: 'embeddings', type: 'TextualInversion' },
  { kind: 'upscale', list: 'upscaleModels', type: 'Upscaler' },
  { kind: 'controlnet', list: 'controlnets', type: 'Controlnet' },
];

export const isLocalModel = (m: { id: number }): boolean => m.id < 0;

/** The file's base name, lower-cased, extension dropped: how a server name and a CivitAI file name meet. */
export function baseKey(name: string): string {
  const b = name.split('/').pop() ?? name;
  return b.replace(/\.[^.]+$/, '').toLowerCase();
}

/** A stable negative id for a kind + file, so favourites and selection survive a reload. */
export function localId(kind: string, name: string): number {
  let h = 0;
  const s = `${kind}:${name}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return -(Math.abs(h) || 1);
}

export function localLabel(name: string): string {
  const b = name.split('/').pop() ?? name;
  return b.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i, '');
}

export function localModel(kind: LocalKind, name: string, type: string, hash?: string): CivitaiModel {
  const id = localId(kind, name);
  const folder = name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '';
  return {
    id,
    name: localLabel(name),
    description: null,
    type,
    nsfw: false,
    tags: [],
    allowNoCredit: true, allowCommercialUse: [], allowDerivatives: true, allowDifferentLicense: true,
    creator: { username: folder ? `on the server · ${folder}` : 'on the server', image: null },
    stats: { downloadCount: 0, thumbsUpCount: 0, thumbsDownCount: 0, commentCount: 0 },
    modelVersions: [{
      id, name: 'Local file', baseModel: '', createdAt: '', description: null, trainedWords: [], images: [],
      stats: { downloadCount: 0, thumbsUpCount: 0, thumbsDownCount: 0, commentCount: 0 },
      files: [{ id, name: name.split('/').pop() ?? name, sizeKB: 0, type: 'Model', primary: true, metadata: { fp: null, size: null, format: null }, hashes: hash ? { SHA256: hash } : {}, downloadUrl: '' }],
    }],
    nsfwLevel: 1,
  };
}

/**
 * Local items for every server file that no CivitAI-known model covers.
 * `known` = the CivitAI-found models already listed; a file is covered when one of their
 * versions has a file with the same base name.
 */
export function localModelsFor(
  files: Iterable<{ kind: LocalKind; name: string; type: string }>,
  known: readonly CivitaiModel[],
  hashOf: (name: string) => string | undefined,
): CivitaiModel[] {
  const covered = new Set<string>();
  for (const m of known) for (const v of m.modelVersions) for (const f of v.files ?? []) covered.add(baseKey(f.name));
  const out: CivitaiModel[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const key = `${f.kind}:${baseKey(f.name)}`;
    if (seen.has(key) || covered.has(baseKey(f.name))) continue;
    seen.add(key);
    out.push(localModel(f.kind, f.name, f.type, hashOf(f.name)));
  }
  return out;
}
