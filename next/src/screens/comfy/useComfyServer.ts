/**
 * The server the ComfyUI screen looks at (rule 14: the Image · Video switch). The list and roles
 * are the main app's (`@/lib/store` servers, `@/lib/serverRoles`); the pick is remembered in
 * `workflowStore`. Image = the server images go to, Video = the video one (the pod's
 * `/video-comfy`, found by `useVideoServerProbe`); with one server both are the same box.
 */
import { useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { pickServerForMode, serversForMode } from '@/lib/serverRoles';
import type { Server } from '@/lib/storage';
import { useWorkflowStore, type ComfyKind } from './workflowStore';

export interface ComfyServerPick {
  kind: ComfyKind;
  server: Server | null;
  imageServer: Server | null;
  videoServer: Server | null;
  servers: Server[];
  setKind: (k: ComfyKind) => void;
  select: (s: Server) => void;
}

export function useComfyServer(): ComfyServerPick {
  const servers = useStore((s) => s.servers);
  const kind = useWorkflowStore((s) => s.kind);
  const serverId = useWorkflowStore((s) => s.serverId);
  const setServer = useWorkflowStore((s) => s.setServer);

  const imageServer = useMemo(() => pickServerForMode(servers, 'image', kind === 'image' ? serverId : null), [servers, kind, serverId]);
  const videoServer = useMemo(() => pickServerForMode(servers, 'video', kind === 'video' ? serverId : null), [servers, kind, serverId]);
  const server = kind === 'video' ? videoServer : imageServer;

  const setKind = useCallback((k: ComfyKind) => setServer(k, null), [setServer]);
  const select = useCallback((s: Server) => {
    // Keep the current side when the server can run it; else switch to the side it runs.
    const fits = serversForMode(useStore.getState().servers, useWorkflowStore.getState().kind).some((x) => x.id === s.id);
    const k: ComfyKind = fits ? useWorkflowStore.getState().kind : useWorkflowStore.getState().kind === 'image' ? 'video' : 'image';
    setServer(k, s.id);
  }, [setServer]);

  return { kind, server, imageServer, videoServer, servers, setKind, select };
}
