/**
 * Per-server facts for the server popover (fix list 37): `/system_stats` (GPU, VRAM, ComfyUI
 * version; cached per host) and ImageLabCore's live-preview cap (`GET / POST
 * /imagelab/api/preview-size`, no restart; absent on a box without ImageLabCore).
 */
import { useCallback, useEffect, useState } from 'react';
import { comfyHttpFor } from '@/lib/comfyHost';
import { gpuLabel } from '../gpuLabel';

export interface HostStats { gpu: string; vramGb: number | null; comfy: string | null }

const statsCache = new Map<string, HostStats>();

export function useHostStats(host: string | null, online: boolean): HostStats | null {
  const [stats, setStats] = useState<HostStats | null>(() => (host ? statsCache.get(host) ?? null : null));
  useEffect(() => {
    if (!host || !online) return;
    const hit = statsCache.get(host);
    if (hit) { setStats(hit); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${comfyHttpFor(host)}/system_stats`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const j = await res.json() as { devices?: Array<{ name?: string; vram_total?: number }>; system?: { comfyui_version?: string } };
        const d = j.devices?.[0];
        const s: HostStats = { gpu: gpuLabel(d?.name), vramGb: d?.vram_total ? Math.round(d.vram_total / 1024 ** 3) : null, comfy: j.system?.comfyui_version ?? null };
        statsCache.set(host, s);
        if (!cancelled) setStats(s);
      } catch { /* offline: nothing to show */ }
    })();
    return () => { cancelled = true; };
  }, [host, online]);
  return stats;
}

export interface PreviewSize { size: number; unlimited: boolean }

/** The host's live-preview cap: `undefined` while loading, `null` when the host has no ImageLabCore. */
export function usePreviewSize(host: string | null, enabled: boolean): { value: PreviewSize | null | undefined; set: (size: number) => Promise<boolean>; busy: boolean } {
  const [value, setValue] = useState<PreviewSize | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!host || !enabled) return;
    let cancelled = false;
    setValue(undefined);
    void (async () => {
      try {
        const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/preview-size`, { signal: AbortSignal.timeout(8000) });
        const j = res.ok ? await res.json() as PreviewSize : null;
        if (!cancelled) setValue(j && typeof j.size === 'number' ? { size: j.size, unlimited: !!j.unlimited } : null);
      } catch { if (!cancelled) setValue(null); }
    })();
    return () => { cancelled = true; };
  }, [host, enabled]);
  const set = useCallback(async (size: number) => {
    if (!host) return false;
    setBusy(true);
    try {
      const res = await fetch(`${comfyHttpFor(host)}/imagelab/api/preview-size`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ size }), signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const j = await res.json() as PreviewSize;
      setValue({ size: j.size, unlimited: !!j.unlimited });
      return true;
    } catch { return false; } finally { setBusy(false); }
  }, [host]);
  return { value, set, busy };
}
