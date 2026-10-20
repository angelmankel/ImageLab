/**
 * "Installed ✓" (rule 13): a CivitAI file is on the server when its hash is in the ImageLab node's
 * hash list (`useStore().modelHashes`, kept fresh by `@/hooks/useModelHashes`) or a server's model
 * lists carry its name (`useStore().serverInfo`). Also the Installed source: the servers' hashed
 * files that resolved to CivitAI (`useStore().civitaiByHash`) shaped as list items.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { ServerInfo } from '@/lib/types';
import type { CivitaiModel, CivitaiVersionByHash } from '@/lib/civitai';
import { buildInstalledIndex, modelInstalled, versionInstalled, fileInstalled, type InstalledIndex, type InstalledState, type FileLike, type VersionLike, type ModelLike } from './civitaiQuery';
import { LOCAL_LISTS, localModelsFor, type LocalKind } from './localModels';

function* serverFiles(serverInfo: Record<string, ServerInfo>): Iterable<{ kind: LocalKind; name: string; type: string }> {
  for (const info of Object.values(serverInfo)) {
    for (const { kind, list, type } of LOCAL_LISTS) {
      const names = info[list];
      if (Array.isArray(names)) for (const n of names) if (typeof n === 'string') yield { kind, name: n, type };
    }
  }
}
function* serverNames(serverInfo: Record<string, ServerInfo>): Iterable<string> {
  for (const f of serverFiles(serverInfo)) yield f.name;
}

export interface Installed {
  index: InstalledIndex;
  /** True once a server has reported (an empty index before that means "unknown", not "none"). */
  known: boolean;
  model: (m: ModelLike) => InstalledState;
  version: (v: VersionLike) => boolean;
  file: (f: FileLike) => boolean;
  /** The name a server lists the file under (`SDXL/foo.safetensors`), for "Use in step". */
  serverName: (fileName: string) => string | undefined;
  /** `checkpoints/SDXL/foo.safetensors` from the hash list, for Delete. */
  hashKey: (f: FileLike) => string | undefined;
}

// Every tile and button asks for this; the index is built once per (hashes, serverInfo) pair.
let last: { hashes: unknown; serverInfo: unknown; value: Installed } | null = null;

export function useInstalled(): Installed {
  const hashes = useStore((s) => s.modelHashes);
  const serverInfo = useStore((s) => s.serverInfo);
  return useMemo(() => {
    if (last && last.hashes === hashes && last.serverInfo === serverInfo) return last.value;
    const value = buildInstalled(hashes, serverInfo);
    last = { hashes, serverInfo, value };
    return value;
  }, [hashes, serverInfo]);
}

function buildInstalled(hashes: ReturnType<typeof useStore.getState>['modelHashes'], serverInfo: Record<string, ServerInfo>): Installed {
  {
    const names = [...serverNames(serverInfo)];
    const index = buildInstalledIndex(hashes.map((h) => h.hash), names);
    const byBase = new Map<string, string>();
    for (const n of names) { const b = n.split('/').pop() ?? n; if (!byBase.has(b)) byBase.set(b, n); byBase.set(b.replace(/\.[^.]+$/, ''), n); }
    return {
      index,
      known: names.length > 0 || hashes.length > 0,
      model: (m) => modelInstalled(m, index),
      version: (v) => versionInstalled(v, index),
      file: (f) => fileInstalled(f, index),
      serverName: (fileName) => {
        const b = fileName.split('/').pop() ?? fileName;
        return byBase.get(b) ?? byBase.get(b.replace(/\.[^.]+$/, ''));
      },
      hashKey: (f) => {
        const want = new Set(Object.values(f.hashes ?? {}).filter(Boolean).map((h) => h!.toUpperCase()));
        const base = f.name.split('/').pop() ?? f.name;
        return (hashes.find((h) => want.has(h.hash.toUpperCase())) ?? hashes.find((h) => h.filename === base))?.key;
      },
    };
  }
}

/**
 * The Installed source: every hashed server file that CivitAI knows, one item per CivitAI model —
 * PLUS a local item for every other server file (not hashed yet, lookup pending / failed, or not
 * on CivitAI at all), so the Downloaded list is really everything on the server.
 */
export function useInstalledModels(): CivitaiModel[] {
  const hashes = useStore((s) => s.modelHashes);
  const byHash = useStore((s) => s.civitaiByHash);
  const serverInfo = useStore((s) => s.serverInfo);
  return useMemo(() => {
    const out = new Map<number, CivitaiModel>();
    for (const h of hashes) {
      const entry = byHash[h.hash];
      if (!entry || entry.status !== 'found' || !entry.data) continue;
      const v = entry.data as CivitaiVersionByHash;
      const existing = out.get(v.modelId);
      if (existing) {
        if (!existing.modelVersions.some((x) => x.id === v.id)) existing.modelVersions.push(v);
        continue;
      }
      out.set(v.modelId, {
        id: v.modelId,
        name: v.model?.name ?? h.filename,
        description: null,
        type: v.model?.type ?? 'Other',
        nsfw: !!v.model?.nsfw,
        tags: [],
        allowNoCredit: true, allowCommercialUse: [], allowDerivatives: true, allowDifferentLicense: true,
        creator: { username: '', image: null },
        stats: v.stats ?? { downloadCount: 0, thumbsUpCount: 0, thumbsDownCount: 0, commentCount: 0 },
        modelVersions: [v],
        nsfwLevel: Math.max(0, ...(v.images ?? []).map((i) => i.nsfwLevel ?? 0)),
        poi: v.model?.poi,
      });
    }
    const known = [...out.values()];
    const hashOf = (name: string) => { const b = name.split('/').pop() ?? name; return hashes.find((h) => h.filename === b || h.key.endsWith('/' + b) || h.key === b)?.hash; };
    const local = localModelsFor(serverFiles(serverInfo), known, hashOf);
    return [...known, ...local].sort((a, b) => a.name.localeCompare(b.name));
  }, [hashes, byHash, serverInfo]);
}
