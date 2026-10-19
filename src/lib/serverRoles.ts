/**
 * Which ComfyUI server runs what.
 *
 * A pod can run a second ComfyUI for video on the same origin under `/video-comfy/`. Images go to
 * the image server(s), video to the video one, so a video can render while images generate. With
 * one server, or none marked, every mode shares it and queues as before. Imports nothing.
 */

export type ServerRole = 'image' | 'video' | 'both';

export interface RoleServer {
  id: string;
  host: string;
  enabled?: boolean;
  /** Set in Settings; when missing the host path decides. */
  role?: ServerRole;
}

/** The path a pod serves its video ComfyUI under. */
export const VIDEO_PATH = '/video-comfy';

/** Inferred from the host when no role was set: a `/video-comfy` path is the video server. */
export function serverRole(s: RoleServer): ServerRole {
  if (s.role) return s.role;
  return hostPath(s.host).replace(/\/+$/, '') === VIDEO_PATH ? 'video' : 'both';
}

/** The path part of a host like `pod:8188/video-comfy` ('' when none). */
export function hostPath(host: string): string {
  const i = host.indexOf('/');
  return i < 0 ? '' : host.slice(i);
}

export const canRunVideo = (s: RoleServer) => serverRole(s) !== 'image';
export const canRunImages = (s: RoleServer) => serverRole(s) !== 'video';

/**
 * The servers a mode may use. Video prefers servers marked for video and falls back to any that
 * is not image-only; images prefer servers not marked video-only, so the video box is left to
 * video, and fall back to every enabled server when nothing else is there.
 */
export function serversForMode(servers: readonly RoleServer[], mode: 'image' | 'video' | 'workflow'): RoleServer[] {
  const on = servers.filter(s => s.enabled !== false);
  if (mode === 'video') {
    const dedicated = on.filter(s => serverRole(s) === 'video');
    if (dedicated.length) return dedicated;
    return on.filter(canRunVideo);
  }
  const image = on.filter(canRunImages);
  // A video-only box is still better than nothing.
  return image.length || !on.length ? image : on;
}

/** The one server a mode runs on: the pinned one if it fits the mode, else the first that does. */
export function pickServerForMode<T extends RoleServer>(servers: readonly T[], mode: 'image' | 'video' | 'workflow', pinnedId: string | null): T | null {
  const fit = serversForMode(servers, mode) as T[];
  return fit.find(s => s.id === pinnedId) ?? fit[0] ?? null;
}

/**
 * Keep the pod's video ComfyUI in the list exactly once when it answers, and drop a stale entry
 * for a host that moved. The image entry for the same origin is left alone.
 */
export function withVideoServer<T extends RoleServer & { name: string }>(
  servers: readonly T[], origin: string, present: boolean, make: (host: string) => T,
): T[] {
  const host = `${origin}${VIDEO_PATH}`;
  const stale = servers.filter(s => s.role === 'video' && hostPath(s.host) === VIDEO_PATH && s.host !== host);
  const kept = servers.filter(s => !stale.includes(s));
  const existing = kept.find(s => s.host === host);
  if (!present) return stale.length ? kept : [...servers];
  if (existing) return kept.map(s => s === existing ? { ...s, role: 'video' as const, enabled: true } : s);
  return [...kept, make(host)];
}
