/**
 * Pure rules for the server chip + popover (fix list 37): a LIST of servers is the normal case.
 * No React, no stores: tested in tests/servers.test.cjs.
 */
export interface ServerRowState {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  online: boolean;
  /** This page is served from it ("This pod"). */
  local: boolean;
  gpu?: string;
}

export type ServerStatus = 'online' | 'offline' | 'paused';

export const statusOf = (s: Pick<ServerRowState, 'enabled' | 'online'>): ServerStatus => (!s.enabled ? 'paused' : s.online ? 'online' : 'offline');

/** The display name: the pod this page comes from is "This pod". */
export const serverName = (s: Pick<ServerRowState, 'name' | 'local'>): string => (s.local ? 'This pod' : s.name);

/**
 * The chip's text and tone. One active server: "This pod · RTX A4500" (or its name). Several:
 * "N servers · M online". Warn (ember tint) when an enabled server is offline; error when none is online.
 */
export function chipOf(servers: readonly ServerRowState[]): { label: string; tone: 'ok' | 'warn' | 'err' } {
  const active = servers.filter((s) => s.enabled);
  const online = active.filter((s) => s.online);
  if (!active.length) return { label: servers.length ? 'All servers paused' : 'No server', tone: 'err' };
  if (active.length === 1) {
    const s = active[0];
    return { label: `${serverName(s)}${s.gpu ? ` · ${s.gpu}` : ''}${s.online ? '' : ' · offline'}`, tone: s.online ? 'ok' : 'err' };
  }
  const tone = online.length === 0 ? 'err' : online.length < active.length ? 'warn' : 'ok';
  return { label: `${active.length} servers · ${online.length} online`, tone };
}

/** Preview-size choices (long side, px; 0 = no cap). */
export const PREVIEW_SIZES: ReadonlyArray<{ size: number; label: string }> = [
  { size: 512, label: '512' }, { size: 1024, label: '1024' }, { size: 2048, label: '2048' }, { size: 0, label: 'Max' },
];

/** Which chip a server's current cap lights: an exact match, Max when unlimited, else none. */
export function previewChoice(size: number | null | undefined, unlimited: boolean | undefined): number | null {
  if (unlimited) return 0;
  if (size == null) return null;
  return PREVIEW_SIZES.some((p) => p.size === size) ? size : null;
}
