/**
 * The server chip in the top nav + its popover (fix list 37). A list of servers is the normal
 * case: the chip reads "This pod · RTX A4500" for one, "N servers · M online" for several
 * (`chipOf`). The popover lists EVERY server with its status dot, what it runs, host and GPU;
 * a row opens that host's settings: the ComfyUI live-preview cap (ImageLabCore
 * `/imagelab/api/preview-size`, live, no restart), versions, its own queue, and Pause.
 * "Manage servers →" = the ComfyUI screen (add / edit / remove).
 */
import { useState } from 'react';
import { Popover } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconServer } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { servedFromHost, type Server } from '@/lib/storage';
import { hostPath, serverRole, VIDEO_PATH } from '@/lib/serverRoles';
import { useRoute } from '~/app/routeStore';
import { Pill, Dot, Switch } from '~/ui';
import { Button } from '~/ui/Button';
import { T } from '~/theme/tokens';
import { useGpuName } from '../useGpuName';
import { chipOf, previewChoice, PREVIEW_SIZES, serverName, statusOf, type ServerRowState } from './serversLogic';
import { useHostStats, usePreviewSize } from './useServerHost';
import { usePreviewInfo } from '~/screens/comfy/usePreviewInfo';
import { vh, vw } from '~/theme/uiScale';

const ROLE: Record<'image' | 'video' | 'both', string> = { image: 'images', video: 'video', both: 'images + video' };
const DOT: Record<'online' | 'offline' | 'paused', string> = { online: 'var(--il-ok)', offline: 'var(--il-err)', paused: 'var(--il-dim)' };

const LINE: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 30 };
const KEY: React.CSSProperties = { fontWeight: 700, fontSize: 12, color: 'var(--il-fg)' };
const VAL: React.CSSProperties = { fontSize: 11, color: 'var(--il-muted)', fontWeight: 600, textAlign: 'right' };

function HostSettings({ server, online }: { server: Server; online: boolean }) {
  const enabled = server.enabled !== false;
  const stats = useHostStats(server.host, online);
  const secondary = hostPath(server.host) === VIDEO_PATH;
  const preview = usePreviewSize(secondary ? null : server.host, enabled && online);
  // The real live-preview method: TAESD, or the blurry latent2rgb fallback when decoders are missing.
  const method = usePreviewInfo(server.host, enabled && online);
  const jobs = useStore((s) => s.jobs);
  const updateServer = useStore((s) => s.updateServer);
  const mine = jobs.filter((j) => j.serverId === server.id);
  const running = mine.filter((j) => j.status === 'running').length;
  const waiting = mine.filter((j) => j.status === 'queued').length;
  const choice = preview.value ? previewChoice(preview.value.size, preview.value.unlimited) : null;
  return (
    <div style={{ margin: '0 8px 8px 30px', padding: '6px 10px', borderRadius: T.radius.md, background: 'var(--il-card)', border: '1px solid var(--il-line-soft)' }}>
      <div style={LINE}>
        <span style={KEY}>Live preview size <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>· long side</span></span>
        {secondary ? <span style={VAL}>Set on the pod's image server</span>
          : !online || !enabled ? <span style={VAL}>—</span>
          : preview.value === undefined ? <span style={VAL}>…</span>
          : preview.value === null ? <span style={VAL}>Needs ImageLabCore</span>
          : (
            <span style={{ display: 'flex', gap: 4 }}>
              {PREVIEW_SIZES.map((p) => (
                <Button key={p.size} size="sm" h={26} tone={choice === p.size ? 'light' : 'elev'} disabled={preview.busy}
                  onClick={() => { void preview.set(p.size); }} aria-pressed={choice === p.size}
                  tooltip={p.size ? `Previews up to ${p.size}px` : 'Previews at the render size (no cap)'}>{p.label}</Button>
              ))}
            </span>
          )}
      </div>
      {preview.value && choice === null && !preview.value.unlimited && <div style={{ ...VAL, textAlign: 'left', marginTop: -4 }}>Now {preview.value.size}px</div>}
      <div style={LINE}>
        <span style={KEY}>Live preview method</span>
        <span style={{ ...VAL, color: method?.poor ? 'var(--il-warn)' : VAL.color }} title={method?.hint ?? undefined}>{!online || !enabled ? '—' : method ? method.label : '…'}</span>
      </div>
      {method?.hint && online && enabled && <div style={{ ...VAL, textAlign: 'left', color: 'var(--il-warn)', marginTop: -4, marginBottom: 4 }}>{method.hint}</div>}
      <div style={LINE}>
        <span style={KEY}>ComfyUI</span>
        <span style={VAL}>{stats?.comfy ? `v${stats.comfy}` : online ? '…' : 'offline'}{preview.value ? ' · ImageLabCore' : ''}</span>
      </div>
      <div style={LINE}>
        <span style={KEY}>Queue on this server</span>
        <span style={VAL}>{running} running · {waiting} waiting</span>
      </div>
      <div style={LINE}>
        <Switch label="Use this server" checked={enabled} onChange={(on) => updateServer(server.id, { enabled: on })} />
      </div>
    </div>
  );
}

function ServerRow({ server, online, local, open, onToggle }: { server: Server; online: boolean; local: boolean; open: boolean; onToggle: () => void }) {
  const enabled = server.enabled !== false;
  const stats = useHostStats(server.host, online && enabled);
  const status = statusOf({ enabled, online });
  return (
    <>
      <button type="button" onClick={onToggle} aria-expanded={open} className="il-srv-row"
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px', border: 0, borderRadius: T.radius.md, background: open ? 'var(--il-card)' : 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer', opacity: enabled ? 1 : 0.6, minHeight: 44 }}>
        <Dot color={DOT[status]} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 12 }}>
            {serverName({ name: server.name, local })} <span style={{ color: 'var(--il-muted)', fontWeight: 600 }}>· {ROLE[serverRole(server)]}</span>
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--il-muted)', fontFamily: 'ui-monospace, Menlo, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {server.host}{status !== 'online' ? ` · ${status}` : ''}
          </span>
        </span>
        {stats?.gpu && <span style={{ fontSize: 11, color: 'var(--il-fg2)', whiteSpace: 'nowrap', flex: 'none' }}>{stats.gpu}{stats.vramGb ? ` · ${stats.vramGb} GB` : ''}</span>}
        {open ? <IconChevronDown size={16} color="var(--il-dim)" /> : <IconChevronRight size={16} color="var(--il-dim)" />}
      </button>
      {open && <HostSettings server={server} online={online} />}
    </>
  );
}

export function ServerChip() {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const origin = servedFromHost();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The GPU for the one-server label (the popover rows fetch their own).
  const active = servers.filter((s) => s.enabled !== false);
  const single = active.length === 1 ? active[0] : null;
  const gpu = useGpuName(single && serverInfo[single.id] ? single.host : null);
  const rows: ServerRowState[] = servers.map((s) => ({
    id: s.id, name: s.name, host: s.host, enabled: s.enabled !== false, online: !!serverInfo[s.id], local: !!origin && s.host === origin,
    gpu: single?.id === s.id ? gpu : undefined,
  }));
  const chip = chipOf(rows);
  const firstOpen = expanded ?? rows.find((r) => r.local)?.id ?? rows[0]?.id ?? null;
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" width={400} withinPortal zIndex={T.z.popover}>
      <Popover.Target>
        <span style={{ display: 'inline-flex', minWidth: 0 }}>
          <Pill onClick={() => setOpen((o) => !o)} active={open || chip.tone === 'warn'} aria-haspopup="dialog" aria-expanded={open} title="Servers">
            <Dot color={chip.tone === 'err' ? 'var(--il-err)' : 'var(--il-ok)'} />{chip.label}
          </Pill>
        </span>
      </Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.xl, padding: T.pad.panel, maxWidth: `calc(${vw(100)} - 24px)` }}>
        <div className="il-eyebrow" style={{ margin: '2px 2px 8px', display: 'flex', alignItems: 'center', gap: 6 }}><IconServer size={12} />Servers</div>
        <div className="il-scroll" style={{ maxHeight: `min(${vh(70)}, 520px)` }}>
          {servers.map((s) => (
            <ServerRow key={s.id} server={s} online={!!serverInfo[s.id]} local={!!origin && s.host === origin}
              open={firstOpen === s.id} onToggle={() => setExpanded(firstOpen === s.id ? '' : s.id)} />
          ))}
          {!servers.length && <div style={{ padding: 10, fontSize: 12, color: 'var(--il-muted)' }}>No server yet.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 8px 2px' }}>
          <span style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 600 }}>Jobs go to any server that can run them.</span>
          <button type="button" onClick={() => { setOpen(false); useRoute.getState().go('comfy'); }}
            style={{ border: 0, background: 'transparent', fontSize: 11, fontWeight: 800, color: 'var(--il-ember)', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}>
            Manage servers →
          </button>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
