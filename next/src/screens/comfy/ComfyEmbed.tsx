/**
 * Rule 14 + FIXLIST 34: the embedded ComfyUI (desktop only). Its own toolbar row (52, rule 1:
 * nothing on top of the work area): which server · Generate · New / Save / Save as · Interrupt ·
 * Reload · Hide ComfyUI menus · Open in a new tab. The iframe takes the rest of the height.
 * Generate / New / Save / Save as run ComfyUI's own commands inside the frame (`comfyFrame.ts`),
 * so ComfyUI asks for names itself and writes to its own workflow store. They need the frame on
 * this site (same origin); a ComfyUI elsewhere greys them out.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy, IconExternalLink, IconFilePlus, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand,
  IconPlayerPlayFilled, IconPlayerStop, IconRefresh, IconFileExport,
} from '@tabler/icons-react';
import { interruptPrompt } from '@/lib/comfy';
import type { Server } from '@/lib/storage';
import { Button, Dot, Pill, Sep } from '~/ui';
import { T } from '~/theme/tokens';
import { comfyPageUrl } from './comfyApi';
import { attachFrame, newInFrame, queueInFrame, saveAsInFrame, saveInFrame, setHideMenus, useComfyFrame } from './comfyFrame';

function why(status: string): string {
  return status === 'blocked' ? 'This ComfyUI is on another site: open it in a new tab for this'
    : status === 'loading' ? 'Waiting for ComfyUI to load…' : 'ComfyUI is not open';
}

/** A toolbar action that runs in the frame; greyed out (with the reason as its tooltip) until the frame can be driven. */
function FrameBtn({ label, icon, run, ready, status, onDone, iconOnly, primary }: {
  label: string; icon: ReactNode; run: () => Promise<boolean>; ready: boolean; status: string;
  onDone?: () => void; iconOnly?: boolean; primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try { if (await run()) onDone?.(); }
    catch (err) { notifications.show({ color: 'red', title: `${label} failed`, message: err instanceof Error ? err.message : String(err) }); }
    finally { setBusy(false); }
  };
  return (
    <Button tone={primary ? 'primary' : 'elev'} icon={icon} onClick={() => void click()} aria-disabled={!ready || undefined}
      tooltip={ready ? (iconOnly ? label : undefined) : `${label} · ${why(status)}`} aria-label={label}
      style={{ flex: 'none', opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default' }}>
      {iconOnly ? undefined : label}
    </Button>
  );
}

export function ComfyEmbed({ server, online, running, onWorkflowsChanged }: {
  server: Server | null; online: boolean | null; running: boolean;
  /** A save / new changed the workflow files: refresh the left list. */
  onWorkflowsChanged?: () => void;
}) {
  const [nonce, setNonce] = useState(0);
  const host = server?.host ?? null;
  const url = host ? comfyPageUrl(host) : null;
  const status = useComfyFrame((s) => s.status);
  const hideMenus = useComfyFrame((s) => s.hideMenus);
  const ready = status === 'ready';
  const frameRef = useCallback((el: HTMLIFrameElement | null) => attachFrame(el), []);
  // Saves come back after ComfyUI's own name dialog; the list then picks the file up.
  const changed = () => { onWorkflowsChanged?.(); window.setTimeout(() => onWorkflowsChanged?.(), 1500); };
  const queued = () => notifications.show({ color: 'ember', message: 'Queued in ComfyUI', autoClose: 2000 });

  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="il-scroll-x" style={{ height: T.size.toolbar, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'safe center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--il-line)', overflowX: 'auto', overflowY: 'hidden' }}>
        <Pill title={host ?? undefined} style={{ flex: 'none' }}>
          <Dot color={online ? 'var(--il-ok)' : online === false ? 'var(--il-err)' : 'var(--il-dim)'} />
          {server ? server.name : 'No server'}
        </Pill>
        <Sep />
        <FrameBtn label="Generate" icon={<IconPlayerPlayFilled size={14} />} run={queueInFrame} ready={ready} status={status} onDone={queued} primary />
        <FrameBtn label="New workflow" icon={<IconFilePlus size={16} />} run={newInFrame} ready={ready} status={status} iconOnly />
        <FrameBtn label="Save" icon={<IconDeviceFloppy size={16} />} run={saveInFrame} ready={ready} status={status} onDone={changed} iconOnly />
        <FrameBtn label="Save as…" icon={<IconFileExport size={16} />} run={saveAsInFrame} ready={ready} status={status} onDone={changed} iconOnly />
        <Sep />
        <Button icon={<IconPlayerStop size={15} />} onClick={host && running ? () => void interruptPrompt(host) : undefined}
          tooltip="Stop what is running on this server" style={{ flex: 'none', opacity: host && running ? 1 : 0.45 }}>
          Interrupt
        </Button>
        <Button icon={<IconRefresh size={15} />} onClick={host ? () => setNonce((n) => n + 1) : undefined} tooltip="Reload ComfyUI" style={{ flex: 'none' }} />
        <Button on={hideMenus} onClick={() => setHideMenus(!hideMenus)}
          icon={hideMenus ? <IconLayoutSidebarLeftExpand size={15} /> : <IconLayoutSidebarLeftCollapse size={15} />}
          tooltip={status === 'blocked' ? why(status) : hideMenus ? 'Show ComfyUI’s own menus and sidebars' : 'Hide ComfyUI’s own menus and sidebars: more room, use the buttons here'}
          style={{ flex: 'none', opacity: status === 'blocked' ? 0.45 : 1 }}>
          {hideMenus ? 'Menus hidden' : 'Hide menus'}
        </Button>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" title="Open ComfyUI in a new tab"
            style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', textDecoration: 'none' }}>
            <IconExternalLink size={15} />Open in a new tab
          </a>
        )}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--il-bg-deep)' }}>
        {url && online !== false ? (
          <iframe
            ref={frameRef}
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
