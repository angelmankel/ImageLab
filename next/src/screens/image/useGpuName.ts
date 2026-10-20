/** The GPU of a server, from `/system_stats`, fetched once per host; '' while unknown. */
import { useEffect, useState } from 'react';
import { comfyHttpFor } from '@/lib/comfyHost';
import { gpuLabel } from './gpuLabel';

const cache = new Map<string, string>();

export function useGpuName(host: string | null): string {
  const [name, setName] = useState(() => (host ? cache.get(host) ?? '' : ''));
  useEffect(() => {
    if (!host) { setName(''); return; }
    const hit = cache.get(host);
    if (hit !== undefined) { setName(hit); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${comfyHttpFor(host)}/system_stats`, { signal: AbortSignal.timeout(8000) });
        const json = res.ok ? await res.json() as { devices?: Array<{ name?: string }> } : null;
        const label = gpuLabel(json?.devices?.[0]?.name);
        cache.set(host, label);
        if (!cancelled) setName(label);
      } catch { if (!cancelled) setName(''); }
    })();
    return () => { cancelled = true; };
  }, [host]);
  return name;
}
