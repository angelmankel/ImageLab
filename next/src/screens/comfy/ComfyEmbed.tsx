/**
 * Rule 14: the embedded ComfyUI (desktop only). Its own toolbar row (52, rule 1: nothing on top of
 * the work area): which server · Interrupt · Reload · Open in a new tab. The iframe takes the rest
 * of the height. ComfyUI in the frame runs its own client; this page's socket stays the bus's.
 */
import { useState } from 'react';
import { IconExternalLink, IconPlayerStop, IconRefresh } from '@tabler/icons-react';
import { interruptPrompt } from '@/lib/comfy';
import type { Server } from '@/lib/storage';
import { Dot, Pill, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { comfyPageUrl } from './comfyApi';

export function ComfyEmbed({ server, online, running }: { server: Server | null; online: boolean | null; running: boolean }) {
  const [nonce, setNonce] = useState(0);
  const host = server?.host ?? null;
  const url = host ? comfyPageUrl(host) : null;

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: T.size.toolbar, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--il-line)' }}>
        <Pill title={host ?? undefined}>
          <Dot color={online ? 'var(--il-ok)' : online === false ? 'var(--il-err)' : 'var(--il-dim)'} />
          {server ? server.name : 'No server'}
        </Pill>
        <Sep />
        <Pill onClick={host && running ? () => void interruptPrompt(host) : undefined} title="Stop what is running on this server" style={{ opacity: host && running ? 1 : 0.5 }}>
          <IconPlayerStop size={15} />Interrupt
        </Pill>
        <Pill onClick={host ? () => setNonce((n) => n + 1) : undefined} title="Reload ComfyUI">
          <IconRefresh size={15} />Reload
        </Pill>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" title="Open ComfyUI in a new tab"
            style={{ height: 36, padding: '0 14px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', textDecoration: 'none' }}>
            <IconExternalLink size={15} />Open in a new tab
          </a>
        )}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--il-bg-deep)' }}>
        {url && online !== false ? (
          <iframe
            key={`${url}#${nonce}`}
            src={url}
            title={`ComfyUI · ${server?.name ?? ''}`}
            allow="clipboard-read; clipboard-write; fullscreen"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: 'var(--il-bg-deep)' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--il-muted)', fontSize: 13, fontWeight: 700, textAlign: 'center', padding: 20 }}>
            {server ? `${server.name} is not answering (${server.host}).` : 'No ComfyUI server. Add one in Settings.'}
          </div>
        )}
      </div>
    </main>
  );
}
