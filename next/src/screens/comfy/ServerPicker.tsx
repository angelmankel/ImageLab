/**
 * FIXLIST-2 #52: the ComfyUI screen's server picker (replaces the Image · Video switch). The
 * trigger names the server the page shows ("This pod · RTX A4500") with its role, VRAM and queue
 * in the second line; the dropdown lists every server by name with a status dot, GPU and role
 * (Settings → Servers "Runs"), as the top bar's server popover does (L1 #37). The pick drives the
 * embedded ComfyUI, its workflows, queue and log. `compact` = the phone header's pill.
 * Mockup: agent-handoffs/fixlist2-mockups/52-server-picker.html.
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconCheck, IconChevronDown, IconServer } from '@tabler/icons-react';
import { serverRole } from '@/lib/serverRoles';
import { servedFromHost, type Server } from '@/lib/storage';
import { useRoute } from '~/app/routeStore';
import { Dot } from '~/ui';
import { T } from '~/theme/tokens';
import { useSettingsUi } from '~/screens/settings/settingsStore';
import { useHostStats } from '~/screens/image/servers/useServerHost';
import { serverName } from '~/screens/image/servers/serversLogic';
import { gpuLabel } from '~/screens/image/gpuLabel';
import { vramText, type ServerStats } from './comfyHelpers';
import { pickerLine, pickerTitle, ROLE_LABEL } from './serverPickLogic';
import { usePreviewInfo } from './usePreviewInfo';
import type { ComfyServerPick } from './useComfyServer';
import { vh, vw } from '~/theme/uiScale';

const dotColor = (paused: boolean, online: boolean | null) => (paused ? 'var(--il-dim)' : online ? 'var(--il-ok)' : online === null ? 'var(--il-dim)' : 'var(--il-err)');

const nameOf = (s: Server) => serverName({ name: s.name, local: !!servedFromHost() && s.host === servedFromHost() });

function PickRow({ server, on, online, large, onPick }: { server: Server; on: boolean; online: boolean; large?: boolean; onPick: () => void }) {
  const paused = server.enabled === false;
  const stats = useHostStats(server.host, online && !paused);
  const role = serverRole(server);
  const facts = paused ? 'paused' : !online ? 'offline' : stats?.gpu ? `${stats.gpu}${stats.vramGb ? ` · ${stats.vramGb} GB` : ''}` : server.host;
  const preview = usePreviewInfo(server.host, online && !paused);
  return (
    <button type="button" role="option" aria-selected={on} disabled={paused} onClick={onPick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: large ? 56 : 46, padding: '6px 8px', border: 0, borderRadius: T.radius.md,
        background: on ? 'var(--il-card)' : 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: paused ? 'default' : 'pointer', opacity: paused ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!on && !paused) e.currentTarget.style.background = 'var(--il-card)'; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
      <Dot color={dotColor(paused, online)} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(server)}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {facts}
          {preview && <span title={preview.hint ?? undefined} style={{ color: preview.poor ? 'var(--il-warn)' : undefined }}> · Preview {preview.label}</span>}
        </span>
        {preview?.hint && <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--il-warn)', lineHeight: 1.3, marginTop: 2, whiteSpace: 'normal' }}>{preview.hint}</span>}
      </span>
      <span style={{ flex: 'none', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)' }}>{ROLE_LABEL[role]}</span>
      <span style={{ flex: 'none', width: 14, display: 'grid', placeItems: 'center', color: 'var(--il-ember)' }}>{on && <IconCheck size={14} stroke={3} />}</span>
    </button>
  );
}

export function ServerPicker({ pick, online, stats, queued, up, compact }: {
  pick: ComfyServerPick; online: boolean | null; stats: ServerStats | null; queued: number; up: Record<string, boolean>; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const s = pick.server;
  const paused = s?.enabled === false;
  const gpu = stats?.gpu ? gpuLabel(stats.gpu) || stats.gpu : null;
  const title = s ? pickerTitle(nameOf(s), gpu) : 'No server';
  const line = s ? pickerLine({ role: serverRole(s), online, vram: vramText(stats), queued, host: s.host, paused }) : 'Add one in Settings → Servers';
  const lineBad = !!s && (online === false || paused);
  const onlineCount = pick.servers.filter((x) => x.enabled !== false && (x.id === s?.id ? !!online : !!up[x.id])).length;

  const manage = () => { setOpen(false); useSettingsUi.getState().setCategory('servers'); useRoute.getState().go('settings'); };

  const trigger = compact ? (
    <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={line}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, maxWidth: 220, padding: '0 12px 0 14px', border: 0, borderRadius: 999, background: 'var(--il-elev)', color: 'var(--il-fg)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
      <Dot size={7} color={dotColor(paused, s ? online : false)} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <IconChevronDown size={14} color="var(--il-dim)" style={{ flex: 'none' }} />
    </button>
  ) : (
    <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`ComfyUI server: ${title}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 52, padding: '8px 10px', border: 0, borderRadius: T.radius.lg, background: open ? 'var(--il-card-on)' : 'var(--il-card)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', flex: 'none' }}>
      <Dot color={dotColor(paused, s ? online : false)} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: lineBad ? 'var(--il-err)' : 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
      </span>
      <IconChevronDown size={16} color="var(--il-dim)" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : undefined }} />
    </button>
  );

  return (
    <Popover opened={open} onChange={setOpen} position={compact ? 'bottom-end' : 'bottom-start'} shadow="lg" width={compact ? `min(340px, calc(${vw(100)} - 24px))` : 'target'} withinPortal zIndex={T.z.popover}>
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.xl, padding: 8, minWidth: 280 }}>
        <div className="il-eyebrow" style={{ margin: '2px 4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}><IconServer size={12} />ComfyUI server</div>
        <div role="listbox" aria-label="ComfyUI servers" className="il-scroll" style={{ maxHeight: `min(${vh(60)}, 420px)`, display: 'flex', flexDirection: 'column', gap: 2, touchAction: 'pan-y' }}>
          {pick.servers.map((x) => (
            <PickRow key={x.id} server={x} on={x.id === s?.id} online={x.id === s?.id ? !!online : !!up[x.id]} large={compact}
              onPick={() => { pick.select(x); setOpen(false); }} />
          ))}
          {!pick.servers.length && <div style={{ padding: 10, fontSize: 12, color: 'var(--il-muted)' }}>No server yet.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 6px 2px' }}>
          <span style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 600 }}>{pick.servers.length} server{pick.servers.length === 1 ? '' : 's'} · {onlineCount} online</span>
          <button type="button" onClick={manage}
            style={{ border: 0, background: 'transparent', fontSize: 11, fontWeight: 800, color: 'var(--il-ember)', cursor: 'pointer', whiteSpace: 'nowrap', padding: '6px 0', minHeight: compact ? 40 : undefined }}>
            Manage servers →
          </button>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
