/**
 * What the picker hands back (`ModelPick`, models-picker brief item 1): the model, the chosen
 * version, its primary file, and whether it is already on the pod (with the server's file name).
 * Import-free; tested in `tests/models-tags.test.cjs`.
 */

export interface ModelPick {
  installed: boolean;
  /** The server file name when installed (`SDXL/foo.safetensors`), else null. */
  file: string | null;
  model: { id: number; name: string; type: string; baseModel?: string; tags: string[]; nsfw?: boolean };
  version: {
    id: number; name: string; trainedWords: string[]; baseModel?: string;
    file?: { name: string; sizeKB?: number; downloadUrl: string; format?: string; fp?: string; hashes?: Record<string, string> };
  };
  thumb?: string;
}

interface PickFile { name: string; sizeKB?: number; downloadUrl?: string; primary?: boolean; type?: string; metadata?: { format?: string | null; fp?: string | null } | null; hashes?: Partial<Record<string, string | undefined>> }
interface PickVersion { id: number; name: string; trainedWords?: string[]; baseModel?: string; files?: PickFile[]; images?: Array<{ url?: string }> }
interface PickModel { id: number; name: string; type: string; tags?: string[]; nsfw?: boolean; modelVersions?: PickVersion[] }

/** The file a pick refers to: the primary model file, else the first model file, else the first. */
export function pickFile(v: PickVersion): PickFile | undefined {
  const files = v.files ?? [];
  return files.find((f) => f.primary) ?? files.find((f) => f.type === 'Model' || f.type == null) ?? files[0];
}

export function buildPick(m: PickModel, v: PickVersion, opts: { serverFile?: string | null; thumb?: string } = {}): ModelPick {
  const f = pickFile(v);
  const hashes: Record<string, string> = {};
  for (const [k, h] of Object.entries(f?.hashes ?? {})) if (h) hashes[k] = h;
  return {
    installed: !!opts.serverFile,
    file: opts.serverFile ?? null,
    model: { id: m.id, name: m.name, type: m.type, baseModel: v.baseModel, tags: [...(m.tags ?? [])], nsfw: m.nsfw },
    version: {
      id: v.id, name: v.name, trainedWords: [...(v.trainedWords ?? [])], baseModel: v.baseModel,
      file: f ? { name: f.name, sizeKB: f.sizeKB, downloadUrl: f.downloadUrl ?? '', format: f.metadata?.format ?? undefined, fp: f.metadata?.fp ?? undefined, hashes } : undefined,
    },
    thumb: opts.thumb ?? v.images?.[0]?.url,
  };
}
