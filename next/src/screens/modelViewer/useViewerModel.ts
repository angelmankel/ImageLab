/**
 * Everything the viewer shows, from the target: a `{ modelId }` goes straight to the Models
 * screen's `useModelDetail`; a `{ file }` first resolves through the main app's hash → CivitAI
 * cache (`resolveFileTarget`) and keeps the local facts (hash, folder, which servers have it)
 * either way. While the full payload loads, the list item (or the by-hash version) stands in, so
 * the picture area is never blank.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { findModelHash } from '@/lib/modelHash';
import { serversWithModel } from '@/lib/routing';
import type { CivitaiImage, CivitaiModel, CivitaiModelVersion, CivitaiVersionByHash } from '@/lib/civitai';
import { readModelMeta, type ModelMeta } from '~/screens/image/model/useModelMeta';
import { useModelDetail, useVersionImages } from '~/screens/models/useModelDetail';
import { useModels } from '~/screens/models/modelsStore';
import { useModelViewer, type ModelViewerTarget } from './viewerStore';
import { imageKey } from '@/lib/previewOrder';
import { clampIndex, fileLookupState, folderOfKey, mergeGallery, modelFromVersion, resolveFileTarget, withStartImage, type FileLookupState } from './modelViewerLogic';
import { passesMask } from '~/screens/models/civitaiQuery';

export interface LocalFile {
  name: string;
  state: FileLookupState;
  hash?: string;
  /** `checkpoints/SDXL/foo.safetensors` from the hash list. */
  key?: string;
  folder: string;
  /** Names of the servers that list the file. */
  servers: string[];
  meta: ModelMeta;
}

export interface ViewerData {
  modelId: number | null;
  /** The full payload, or the list item / by-hash version standing in. */
  model: CivitaiModel | null;
  full: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
  version: CivitaiModelVersion | undefined;
  gallery: ReturnType<typeof useVersionImages>;
  index: number;
  /** Set for a `{ file }` target. */
  local: LocalFile | null;
}

const EMPTY: never[] = [];

export function useViewerModel(target: ModelViewerTarget | null): ViewerData {
  const hashes = useStore((s) => s.modelHashes);
  const byHash = useStore((s) => s.civitaiByHash);
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const versionId = useModelViewer((s) => s.versionId);
  const imageIndex = useModelViewer((s) => s.imageIndex);
  const mask = useModels((s) => s.filters.nsfwMask);

  const file = target && 'file' in target ? target.file : null;
  const resolved = useMemo(() => (file ? resolveFileTarget(file, hashes, byHash) : null), [file, hashes, byHash]);
  const modelId = target ? ('modelId' in target ? target.modelId : resolved?.modelId ?? null) : null;

  const { model: fullModel, loading, error, retry } = useModelDetail(modelId);
  const listItem = useModels((s) => (modelId == null ? undefined : s.items.find((m) => m.id === modelId)));

  const local = useMemo<LocalFile | null>(() => {
    if (!file) return null;
    const h = findModelHash(hashes, file);
    return {
      name: file,
      state: fileLookupState(file, hashes, byHash),
      hash: h?.hash,
      key: h?.key,
      folder: folderOfKey(h?.key),
      servers: serversWithModel(serverInfo, file).map((id) => servers.find((s) => s.id === id)?.name ?? id),
      meta: readModelMeta(file, hashes, byHash),
    };
  }, [file, hashes, byHash, servers, serverInfo]);

  const standIn = useMemo<CivitaiModel | null>(() => {
    if (listItem) return listItem;
    if (!local?.hash) return null;
    const entry = byHash[local.hash];
    if (!entry || entry.status !== 'found' || !entry.data) return null;
    return modelFromVersion(entry.data as CivitaiVersionByHash, local.meta.label);
  }, [listItem, local, byHash]);

  const model = fullModel ?? standIn;
  const wanted = versionId ?? resolved?.versionId ?? null;
  const version = useMemo(() => model?.modelVersions.find((v) => v.id === wanted) ?? model?.modelVersions[0], [model, wanted]);
  // Item 28: every picture — the creator's samples (within the Max rating) first, then the whole
  // community gallery, page by page (`raw.loadMore`, cursor-based).
  const api = useVersionImages(version?.id ?? null, mask, EMPTY);
  const samples = useMemo(() => (version?.images ?? EMPTY).filter((i) => passesMask(i.nsfwLevel, mask)), [version, mask]);
  const merged = useMemo(() => mergeGallery(samples, api.items, imageKey), [samples, api.items]);
  const raw = useMemo(() => ({ ...api, items: merged, loading: api.loading && merged.length === 0 }), [api, merged]);
  // The picture the tapped preview showed comes first, while the tapped version is the one shown.
  const start = target?.start;
  const startOn = !!start && !!version && (start.versionId == null || start.versionId === version.id);
  const items = useMemo(() => {
    if (!startOn || !start) return raw.items;
    const img: CivitaiImage = { url: start.url, type: start.type, width: start.width ?? 0, height: start.height ?? 0, nsfwLevel: start.nsfwLevel as number, meta: null };
    return withStartImage(raw.items, img, imageKey);
  }, [raw.items, startOn, start]);
  const gallery = useMemo(() => (items === raw.items ? raw : { ...raw, items }), [raw, items]);
  const index = clampIndex(imageIndex, gallery.items.length);

  return { modelId, model, full: !!fullModel, loading, error, retry, version, gallery, index, local };
}
