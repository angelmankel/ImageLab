/**
 * Rule 14: the status under the server switch: "This pod · B200 · ComfyUI 0.3.75", then VRAM in
 * use and how many prompts are on the server.
 */
import type { Server } from '@/lib/storage';
import { statusLine, vramText, type ServerStats } from './comfyHelpers';

export function ServerStatus({ server, online, stats, queued, align = 'left' }: {
  server: Server | null; online: boolean | null; stats: ServerStats | null; queued: number; align?: 'left' | 'center';
}) {
  if (!server) return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', textAlign: align }}>No server for this. Add one in Settings.</div>;
  const second = online ? [vramText(stats) && `VRAM ${vramText(stats)}`, queued ? `${queued} on the server` : 'idle'].filter(Boolean).join(' · ') : online === null ? 'checking…' : server.host;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: align, padding: '0 4px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: online === false ? 'var(--il-err)' : 'var(--il-fg2)' }}>{statusLine(server.name, stats, online !== false)}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{second}</span>
    </div>
  );
}
