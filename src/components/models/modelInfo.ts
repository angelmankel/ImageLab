/**
 * What the v1 model cards show about a file, read from the new app's hash → CivitAI cache:
 * preview images, base model, CivitAI name, trigger words, description, hash.
 */
import { useStore } from '@/lib/store';
import { findModelHash, bucketForBaseModel, type BaseModelBucket } from '@/lib/modelHash';
import type { CivitaiVersionByHash } from '@/lib/civitai';

export interface ModelInfo {
  hash?: string;
  /** False until the hash lookup has resolved either way. */
  resolved: boolean;
  images: string[];
  baseModel?: string;
  bucket: BaseModelBucket;
  name?: string;
  description?: string;
  trainedWords: string[];
}

const NONE: ModelInfo = { resolved: false, images: [], bucket: 'Unknown', trainedWords: [] };

export function readModelInfo(fileName: string): ModelInfo {
  const { modelHashes, civitaiByHash } = useStore.getState();
  const match = findModelHash(modelHashes, fileName);
  // Hashes loaded but this file is not among them: nothing more is coming, so stop "loading".
  if (!match) return modelHashes.length ? { ...NONE, resolved: true } : NONE;
  const entry = civitaiByHash[match.hash];
  if (!entry) return { ...NONE, hash: match.hash };
  if (entry.status !== 'found') return { ...NONE, hash: match.hash, resolved: true };
  const data = entry.data as CivitaiVersionByHash;
  return {
    hash: match.hash,
    resolved: true,
    images: (data.images ?? []).map((i) => i.url).filter((u): u is string => !!u),
    baseModel: data.baseModel,
    bucket: bucketForBaseModel(data.baseModel),
    name: data.model?.name,
    description: data.description ?? undefined,
    trainedWords: data.trainedWords ?? [],
  };
}

/** Re-reads whenever hashes or CivitAI entries change. */
export function useModelInfo(fileName: string): ModelInfo {
  useStore((s) => s.modelHashes);
  useStore((s) => s.civitaiByHash);
  return readModelInfo(fileName);
}

/** Last path segment without the extension — how v1 labelled a model. */
export function modelLabel(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, '').replace(/\.(safetensors|ckpt|pt|pth|bin|sft)$/i, '');
}

/** Strip CivitAI's HTML description down to text. */
export function plainDescription(html?: string): string {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
