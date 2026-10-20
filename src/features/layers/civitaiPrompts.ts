/**
 * Prompts from CivitAI for the models on this server — the data side, shared by the old
 * `CivitaiPromptsModal` and the prompt hub's inline Library (`features/next/CivitaiLibrary`).
 * Every installed checkpoint and LoRA that CivitAI knows (hash → version) is a model; a model's
 * gallery comes from the Images API, the only endpoint that keeps each picture's `meta`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { fetchCivitaiImages, isCivitaiVideo, type CivitaiImage, type CivitaiVersionByHash, type NsfwFilter } from '@/lib/civitai';
import { modelLabel } from '@/components/models/modelInfo';
import { bucketForBaseModel } from '@/lib/modelHash';
import { isVideoModelName } from '@/lib/wanGraph';

export type InstalledCivitai = { file: string; versionId: number; modelId: number; model: string; version: string; type: string; preview?: string; video: boolean };

export const NSFW_KEY = 'imagelab.civitaiPrompts.nsfw';
const typeRank = (t: string) => (t === 'Checkpoint' ? 0 : /lora|locon|dora/i.test(t) ? 1 : 2);

export function loadNsfw(): NsfwFilter {
  try { return (localStorage.getItem(NSFW_KEY) as NsfwFilter) || 'all'; } catch { return 'all'; }
}
export function saveNsfw(v: NsfwFilter) {
  try { localStorage.setItem(NSFW_KEY, v); } catch { /* ignore */ }
}

/**
 * Every installed file CivitAI resolved, the current checkpoint and LoRAs first. `only`:
 * `video` keeps the Wan / MiniMax H3 files, `image` everything else.
 */
export function useInstalledCivitai(only?: 'video' | 'image'): InstalledCivitai[] {
  const hashes = useStore((s) => s.modelHashes);
  const byHash = useStore((s) => s.civitaiByHash);
  const checkpoint = useStore((s) => s.workflow.checkpoints[0]?.name);
  const loras = useStore((s) => s.workflow.loras);
  return useMemo(() => {
    const active = new Set([checkpoint, ...loras.map((l) => l.name)].filter(Boolean));
    const seen = new Set<number>();
    const list: InstalledCivitai[] = [];
    for (const h of hashes) {
      const e = byHash[h.hash];
      if (!e || e.status !== 'found') continue;
      const d = e.data as CivitaiVersionByHash;
      if (!d?.id || seen.has(d.id)) continue;
      seen.add(d.id);
      const bucket = bucketForBaseModel(d.baseModel);
      list.push({ file: h.filename, versionId: d.id, modelId: d.modelId, model: d.model?.name ?? modelLabel(h.filename), version: d.name, type: d.model?.type ?? '', preview: d.images?.[0]?.url,
        video: bucket === 'Wan Video' || bucket === 'MiniMax H3' || isVideoModelName(h.filename) });
    }
    const isActive = (m: InstalledCivitai) => [...active].some((a) => a && (m.file === a || m.file.endsWith(`/${a}`) || a.endsWith(`/${m.file}`) || modelLabel(a) === modelLabel(m.file)));
    const sorted = list.sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || typeRank(a.type) - typeRank(b.type) || a.model.localeCompare(b.model));
    return only === 'video' ? sorted.filter((m) => m.video) : only === 'image' ? sorted.filter((m) => !m.video) : sorted;
  }, [hashes, byHash, checkpoint, loras, only]);
}

/**
 * One model version's gallery: the pictures that carry a prompt, a few CivitAI pages at a time.
 * Reloads when the version or the filter changes; `more()` appends the next pages.
 */
export function useCivitaiGallery(versionId: number | null, nsfw: NsfwFilter, enabled = true) {
  const [items, setItems] = useState<CivitaiImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const gen = useRef(0);

  const load = useCallback(async (id: number, next: string | null, append: boolean) => {
    const my = ++gen.current;
    setLoading(true); setFailed(false);
    // CivitAI pages are 10; pull a few at once so the grid fills.
    const got: CivitaiImage[] = []; let c = next;
    for (let i = 0; i < 3; i++) {
      const page = await fetchCivitaiImages(id, c, nsfw);
      if (my !== gen.current) return;
      if (!page) { setFailed(got.length === 0 && !append); break; }
      got.push(...page.items); c = page.nextCursor; if (!c) break;
    }
    const usable = got.filter((i) => !isCivitaiVideo(i) && i.meta?.prompt);
    setItems((prev) => (append ? [...prev, ...usable] : usable));
    setCursor(c); setLoading(false);
  }, [nsfw]);

  useEffect(() => {
    if (!enabled || versionId == null) { setItems([]); setCursor(null); return; }
    setItems([]);
    void load(versionId, null, false);
  }, [enabled, versionId, load]);

  const more = useCallback(() => { if (versionId != null && cursor && !loading) void load(versionId, cursor, true); }, [versionId, cursor, loading, load]);
  const reload = useCallback(() => { if (versionId != null) void load(versionId, null, false); }, [versionId, load]);

  return { items, loading, failed, hasMore: !!cursor, more, reload };
}
