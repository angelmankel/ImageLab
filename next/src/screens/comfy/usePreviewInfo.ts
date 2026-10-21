/**
 * The real live-preview method of a ComfyUI server (late FIXLIST-2 item, ./previewLogic): reads
 * `/system_stats` (argv) and `/models/vae_approx`, GET only — the app never writes to the server.
 * Cached per host for a minute, so a popover full of servers asks each once.
 */
import { useEffect, useState } from 'react';
import { comfyHttpFor } from '@/lib/comfyHost';
import { previewArg, previewInfo, type PreviewInfo } from './previewLogic';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; info: PreviewInfo }>();
const inflight = new Map<string, Promise<PreviewInfo | null>>();

async function read(host: string): Promise<PreviewInfo | null> {
  const base = comfyHttpFor(host);
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  };
  try {
    const [stats, files] = await Promise.all([get('/system_stats'), get('/models/vae_approx')]);
    const argv = (stats as { system?: { argv?: unknown } })?.system?.argv;
    const info = previewInfo(previewArg(argv), Array.isArray(files) ? files.map(String) : []);
    cache.set(host, { at: Date.now(), info });
    return info;
  } catch {
    return null;
  }
}

export function usePreviewInfo(host: string | null, online: boolean): PreviewInfo | null {
  const [info, setInfo] = useState<PreviewInfo | null>(() => (host ? cache.get(host)?.info ?? null : null));
  useEffect(() => {
    if (!host || !online) return;
    const hit = cache.get(host);
    setInfo(hit?.info ?? null);
    if (hit && Date.now() - hit.at < TTL_MS) return;
    let cancelled = false;
    let p = inflight.get(host);
    if (!p) { p = read(host).finally(() => inflight.delete(host)); inflight.set(host, p); }
    void p.then((v) => { if (!cancelled && v) setInfo(v); });
    return () => { cancelled = true; };
  }, [host, online]);
  return info;
}
