/**
 * FIXLIST-2 #52: pure rules for the ComfyUI screen's server picker (no React, no stores; tested in
 * tests/comfyServerPick.test.cjs). The picker names servers ("This pod · RTX A4500", "winold");
 * which kind of workflow a step made from it gets follows the server's role.
 */
export type PickKind = 'image' | 'video';
export type PickRole = 'image' | 'video' | 'both';

export const ROLE_LABEL: Record<PickRole, string> = { image: 'Images', video: 'Video', both: 'Images + video' };

/** A video-only server makes video steps, an image-only one image steps; "both" keeps the last kind. */
export function kindForRole(role: PickRole, current: PickKind): PickKind {
  return role === 'both' ? current : role;
}

/** The chosen server when it is still in the list and switched on, else null (the caller falls back). */
export function chosenServer<T extends { id: string; enabled?: boolean }>(servers: readonly T[], id: string | null): T | null {
  if (!id) return null;
  const s = servers.find((x) => x.id === id);
  return s && s.enabled !== false ? s : null;
}

/** The trigger's title: "This pod · RTX A4500" (GPU when known). */
export function pickerTitle(name: string, gpu: string | null | undefined): string {
  return gpu ? `${name} · ${gpu}` : name;
}

/** The trigger's second line: "Images · VRAM 1.1 / 20.0 GB · idle", "Offline · host", "Checking…". */
export function pickerLine(o: { role: PickRole; online: boolean | null; vram: string; queued: number; host: string; paused?: boolean }): string {
  if (o.paused) return `Paused · ${o.host}`;
  if (o.online === false) return `Offline · ${o.host}`;
  if (o.online === null) return `${ROLE_LABEL[o.role]} · checking…`;
  return [ROLE_LABEL[o.role], o.vram && `VRAM ${o.vram}`, o.queued ? `${o.queued} on the server` : 'idle'].filter(Boolean).join(' · ');
}
