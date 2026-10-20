/**
 * Which servers answer right now, for the dots in Settings → Servers. The store's `serverInfo`
 * says so once the shell's connection hook has read a server; until then (or for a server just
 * added) a light `/system_stats` probe every 15 s fills in.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Server } from '@/lib/storage';
import { fetchSystemStats } from '~/screens/comfy/comfyApi';

const EVERY_MS = 15_000;

export function useServersUp(servers: readonly Server[]): Record<string, boolean> {
  const serverInfo = useStore((s) => s.serverInfo);
  const [probed, setProbed] = useState<Record<string, boolean>>({});
  const key = servers.map((s) => `${s.id}=${s.host}=${s.enabled !== false}`).join('|');

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      const on = servers.filter((s) => s.enabled !== false);
      const res = await Promise.allSettled(on.map((s) => fetchSystemStats(s.host)));
      if (stopped) return;
      setProbed(Object.fromEntries(on.map((s, i) => [s.id, res[i].status === 'fulfilled'])));
    };
    void run();
    const t = window.setInterval(() => { if (document.visibilityState !== 'hidden') void run(); }, EVERY_MS);
    return () => { stopped = true; window.clearInterval(t); };
    // `key` stands for the servers' ids, hosts and on/off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return Object.fromEntries(servers.map((s) => [s.id, !!serverInfo[s.id] || !!probed[s.id]]));
}
