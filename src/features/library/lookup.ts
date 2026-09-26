import type { CivitaiModelVersion } from '@/lib/civitai';
import type { CivitaiModelInfo, ModelLibraryCatalog } from '@/lib/modelLibrary';
import { loadCivitaiSettings } from '@/lib/storage';

/**
 * Look one CivitAI model version up by id — enough to describe a download started from a browser
 * tile, whose data carries no parent model name or type. civitai.com first; the adult catalog
 * (civitai.red) serves some versions the main host does not.
 */

const HOSTS: Array<{ catalog: ModelLibraryCatalog; api: string }> = [
  { catalog: 'civitai', api: 'https://civitai.com/api/v1' },
  { catalog: 'red', api: 'https://civitai.red/api/v1' },
];

type VersionPayload = CivitaiModelVersion & {
  modelId?: number;
  model?: { name?: string; type?: string };
};

export type VersionLookup = {
  model: CivitaiModelInfo;
  version: CivitaiModelVersion;
  catalog: ModelLibraryCatalog;
};

async function get(url: string): Promise<VersionPayload | null> {
  // Token as a query param, as lib/civitai does: a custom header would force a CORS preflight.
  const key = loadCivitaiSettings().apiKey.trim();
  const full = key ? `${url}?token=${encodeURIComponent(key)}` : url;
  const res = await fetch(full, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  return (await res.json()) as VersionPayload;
}

export async function lookupVersion(versionId: number): Promise<VersionLookup | null> {
  for (const host of HOSTS) {
    const v = await get(`${host.api}/model-versions/${versionId}`).catch(() => null);
    if (!v || typeof v.id !== 'number') continue;
    return {
      model: { id: v.modelId ?? 0, name: v.model?.name ?? '', type: v.model?.type ?? '' },
      version: v,
      catalog: host.catalog,
    };
  }
  return null;
}
