/**
 * The Style tab's view of the servers: the step's model family (from the Image step's model
 * type) and, per image server, which reference types run there (`styleTabLogic.serverRows`).
 * Reads the classic store's `serverInfo`, which `fetchServerInfo` fills from each server's live
 * /object_info (`ServerInfo.style`); "Check again" re-reads every server.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { workflowFamily, profileById } from '@/lib/modelProfiles';
import { canRunImages } from '@/lib/serverRoles';
import { styleFamily, type StyleFamily } from '@/lib/styleRefs';
import { serverRows, type ServerRow } from './styleTabLogic';

export interface StyleServers {
  fam: StyleFamily | null;
  /** The model type's name ("Pony", "Flux Schnell", "SDXL"). */
  typeName: string;
  rows: ServerRow[];
}

export function useStyleServers(): StyleServers {
  const profile = useStore((s) => s.workflow.modelProfile);
  const servers = useStore((s) => s.servers);
  const infos = useStore((s) => s.serverInfo);
  return useMemo(() => {
    const fam = styleFamily(workflowFamily({ modelProfile: profile }));
    const typeName = profileById(profile)?.id ?? (fam === 'sd15' ? 'SD 1.5' : fam === 'flux' ? 'Flux' : 'SDXL');
    const pool = servers.some((s) => s.enabled !== false && canRunImages(s)) ? servers.filter(canRunImages) : servers;
    return { fam, typeName, rows: serverRows(pool, infos, fam) };
  }, [profile, servers, infos]);
}

/** Re-read every enabled server's /object_info (after installing nodes and restarting ComfyUI). */
export async function recheckServers(): Promise<void> {
  const st = useStore.getState();
  await Promise.all(st.servers.filter((s) => s.enabled !== false).map((s) => st.refreshServerInfo(s.id)));
}
