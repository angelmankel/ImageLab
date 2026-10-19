/**
 * Finds the pod's second ComfyUI (video) and keeps it in the server list, so video jobs have
 * somewhere of their own to go. The pod writes `/pod/logs/instances.json` at boot saying what it
 * launched (`video: null` or `{ path: '/video-comfy/' }`; a 404 is an older, single-instance pod);
 * whether it is up is a separate question, answered by its `/system_stats` (502 while starting).
 * Nothing to do during `npm run dev`, where the page is not served by a pod. The list logic is
 * `lib/serverRoles.ts` (tested).
 */
import { useEffect } from 'react';
import { comfyHttpFor } from '@/lib/comfyHost';
import { VIDEO_PATH, withVideoServer } from '@/lib/serverRoles';
import { servedFromHost, uid, type Server } from '@/lib/storage';
import { useStore } from '@/lib/store';

export function useVideoServerProbe() {
  useEffect(() => {
    const origin = servedFromHost();
    if (!origin) return;
    let cancelled = false;
    void (async () => {
      let present = false;
      try {
        const info = await fetch(`${comfyHttpFor(origin)}/pod/logs/instances.json`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
        const launched = info.ok ? !!(await info.json() as { video?: unknown }).video : false;
        if (launched) {
          const res = await fetch(`${comfyHttpFor(origin + VIDEO_PATH)}/system_stats`, { signal: AbortSignal.timeout(8000) });
          present = res.ok;
        }
      } catch { present = false; }
      if (cancelled) return;
      const servers = useStore.getState().servers;
      const next = withVideoServer(servers, origin, present, (host): Server => ({ id: uid(), name: 'This pod · video', host, enabled: true, role: 'video' }));
      if (next.length !== servers.length || next.some((s, i) => s !== servers[i])) useStore.setState({ servers: next });
    })();
    return () => { cancelled = true; };
  }, []);
}
