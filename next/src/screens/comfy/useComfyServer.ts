/**
 * The server the ComfyUI screen looks at (FIXLIST-2 #52: picked by name in `ServerPicker`). The
 * list and roles are the main app's (`@/lib/store` servers, `@/lib/serverRoles`); the pick is
 * remembered in `workflowStore`. With nothing picked (or the pick removed / paused) it is the
 * first server that runs the remembered kind. `kind` follows the picked server's role
 * (video-only → video, image-only → image, both → the last kind) and is what "Use as step" saves.
 */
import { useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { pickServerForMode, serverRole } from '@/lib/serverRoles';
import type { Server } from '@/lib/storage';
import { useWorkflowStore, type ComfyKind } from './workflowStore';
import { chosenServer, kindForRole } from './serverPickLogic';

export interface ComfyServerPick {
  kind: ComfyKind;
  server: Server | null;
  servers: Server[];
  select: (s: Server) => void;
}

export function useComfyServer(): ComfyServerPick {
  const servers = useStore((s) => s.servers);
  const storedKind = useWorkflowStore((s) => s.kind);
  const serverId = useWorkflowStore((s) => s.serverId);
  const setServer = useWorkflowStore((s) => s.setServer);

  const server = useMemo(
    () => chosenServer(servers, serverId) ?? pickServerForMode(servers, storedKind, null) ?? pickServerForMode(servers, 'workflow', null),
    [servers, serverId, storedKind],
  );
  const kind = server ? kindForRole(serverRole(server), storedKind) : storedKind;

  const select = useCallback((s: Server) => {
    setServer(kindForRole(serverRole(s), useWorkflowStore.getState().kind), s.id);
  }, [setServer]);

  return { kind, server, servers, select };
}
