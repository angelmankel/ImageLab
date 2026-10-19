/**
 * Finds the pod's second ComfyUI (video) at `<origin>/video-comfy/` and keeps it in the server
 * list, so video jobs have somewhere of their own to go. Nothing to do during `npm run dev`, where
 * the page is not served by a pod. The list logic is `lib/serverRoles.ts` (tested).
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
        const res = await fetch(`${comfyHttpFor(origin + VIDEO_PATH)}/system_stats`, { signal: AbortSignal.timeout(8000) });
        present = res.ok;
      } catch { present = false; }
      if (cancelled) return;
      const servers = useStore.getState().servers;
      const next = withVideoServer(servers, origin, present, (host): Server => ({ id: uid(), name: 'This pod · video', host, enabled: true, role: 'video' }));
      if (next.length !== servers.length || next.some((s, i) => s !== servers[i])) useStore.setState({ servers: next });
    })();
    return () => { cancelled = true; };
  }, []);
}
