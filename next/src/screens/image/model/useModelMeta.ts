/**
 * What the Model tab knows about a model file (rule 4): its label, CivitAI name, previews, base
 * model, trigger words, page link and stats — read from the main app's hash → CivitAI cache
 * (`useStore().modelHashes` / `civitaiByHash`, filled by `@/hooks/useModelHashes`). Logic only;
 * the look is in the components next to this file.
 */
import { useStore } from '@/lib/store';
import { findModelHash, bucketForBaseModel, type BaseModelBucket } from '@/lib/modelHash';
import { previewStill, type CivitaiCacheEntry, type CivitaiImage, type CivitaiVersionByHash } from '@/lib/civitai';
import type { ModelHash } from '@/lib/comfy';
import { civitaiPageUrl, thumbUrl } from '@/lib/modelLibrary';
import { modelLabel } from '@/components/models/modelInfo';

export interface ModelMeta {
  file: string;
  /** File name without path and extension. */
  label: string;
  /** CivitAI's model name, when known. */
  name?: string;
  /** False until the hash lookup has resolved either way. */
  resolved: boolean;
  /** Preview stills in CivitAI's curated order (videos already turned into stills). */
  images: string[];
  /** The same pictures as CivitAI sent them (type, NSFW level) — what `useModelPreview` orders. */
  samples: CivitaiImage[];
  /** The CivitAI version the file hashed to. */
  versionId?: number;
  baseModel?: string;
  bucket: BaseModelBucket;
  trainedWords: string[];
  civitaiUrl?: string;
  rating?: number;
  downloads?: number;
}

const NO_SAMPLES: CivitaiImage[] = [];

export function readModelMeta(file: string, hashes: ModelHash[], civitaiByHash: Record<string, CivitaiCacheEntry>): ModelMeta {
  const base: ModelMeta = { file, label: modelLabel(file), resolved: false, images: [], samples: NO_SAMPLES, bucket: 'Unknown', trainedWords: [] };
  const match = findModelHash(hashes, file);
  if (!match) return hashes.length ? { ...base, resolved: true } : base;
  const entry = civitaiByHash[match.hash];
  if (!entry) return base;
  if (entry.status !== 'found') return { ...base, resolved: true };
  const data = entry.data as CivitaiVersionByHash;
  return {
    ...base,
    resolved: true,
    name: data.model?.name,
    images: (data.images ?? []).map((i) => previewStill(i)).filter((u) => !!u),
    samples: data.images ?? NO_SAMPLES,
    versionId: typeof data.id === 'number' ? data.id : undefined,
    baseModel: data.baseModel,
    bucket: bucketForBaseModel(data.baseModel),
    trainedWords: data.trainedWords ?? [],
    civitaiUrl: data.modelId ? civitaiPageUrl(data.modelId, data.id) : undefined,
    rating: data.stats?.rating,
    downloads: data.stats?.downloadCount,
  };
}

/** Re-reads whenever hashes or CivitAI entries change. */
export function useModelMeta(file: string): ModelMeta {
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);
  return readModelMeta(file, hashes, civitai);
}

/** A small CivitAI thumbnail for a preview url (CivitAI resizes by path; other urls pass through). */
export function smallThumb(url: string | undefined, px: number): string | undefined {
  return url ? thumbUrl(url, Math.round(px * 2)) : undefined;
}

/** "SDXL · ★ 4.8 · 212k" — whatever parts are known. */
export function metaLine(m: ModelMeta): string {
  const parts: string[] = [];
  if (m.baseModel) parts.push(m.bucket === 'Other' || m.bucket === 'Unknown' ? m.baseModel : m.bucket);
  if (m.rating) parts.push(`★ ${m.rating.toFixed(1)}`);
  if (m.downloads) parts.push(fmtCount(m.downloads));
  if (!parts.length) return m.resolved ? 'Not on CivitAI' : 'Looking up…';
  return parts.join(' · ');
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
