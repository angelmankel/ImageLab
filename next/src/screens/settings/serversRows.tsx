/**
 * Settings → Servers: one row per ComfyUI server (online dot, name, host, what it runs, Edit /
 * Remove; Edit opens the name / host / role / paused form inline) and the "+ Add server" row
 * with its inline form. Logic = `@/lib/store` (addServer, updateServer, removeServer) and
 * `@/lib/serverRoles`, as the classic Settings → Servers tab. Name and host commit on blur /
 * Enter so typing a host does not reconnect on every key.
 */
import { useEffect, useState } from 'react';
import { Switch as MSwitch, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { serverRole, type ServerRole } from '@/lib/serverRoles';
import type { Server } from '@/lib/storage';
import { Chip, Dot, IconBtn, Tabs } from '~/ui';
import type { SettingDef } from './categories';
import { inputStyles, monoInputStyles } from './inputs';
import { useServersUp } from './useServersUp';

export const ROLE_LABEL: Record<ServerRole, string> = { both: 'Images + video', image: 'Images', video: 'Video' };

const MONO = { fontFamily: 'ui-monospace, Menlo, monospace' } as const;

function ServerForm({ server, onDone }: { server: Server; onDone: () => void }) {
  const updateServer = useStore((s) => s.updateServer);
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  useEffect(() => setName(server.name), [server.name]);
  useEffect(() => setHost(server.host), [server.host]);
  const enabled = server.enabled !== false;
  const commitName = () => { if (name.trim() && name !== server.name) updateServer(server.id, { name: name.trim() }); else setName(server.name); };
  const commitHost = () => { if (host.trim() && host !== server.host) updateServer(server.id, { host: host.trim() }); else setHost(server.host); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12, background: 'var(--il-elev)', border: '1px solid var(--il-line-soft)' }}>
      <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        label="Name" aria-label="Server name" size="sm" styles={inputStyles} />
      <TextInput value={host} onChange={(e) => setHost(e.currentTarget.value)} onBlur={commitHost} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        label="Host" description="host:port, or host:port/video-comfy for the pod's video ComfyUI" aria-label="Server host" placeholder="host:port" size="sm"
        spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)' }}>Runs</span>
        <Tabs<ServerRole> compact value={serverRole(server)} onChange={(role) => updateServer(server.id, { role })}
          items={[{ key: 'both', label: 'Images + video' }, { key: 'image', label: 'Images' }, { key: 'video', label: 'Video' }]} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <MSwitch checked={enabled} onChange={(e) => updateServer(server.id, { enabled: e.currentTarget.checked })} label={enabled ? 'In use' : 'Paused'}
          color="ember" size="sm" styles={{ label: { fontWeight: 700, fontSize: 12, color: 'var(--il-fg2)' } }} />
        <Chip small on onClick={onDone}>Done</Chip>
      </div>
    </div>
  );
}

function ServerRow({ server, online, canRemove }: { server: Server; online: boolean; canRemove: boolean }) {
  const removeServer = useStore((s) => s.removeServer);
  const [editing, setEditing] = useState(false);
  const enabled = server.enabled !== false;
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--il-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: enabled ? 1 : 0.6 }}>
        <span title={!enabled ? 'Paused' : online ? 'Online' : 'Offline'} style={{ display: 'grid', placeItems: 'center', width: 14, flex: 'none' }}>
          <Dot color={!enabled ? 'var(--il-dim)' : online ? 'var(--il-ok)' : 'var(--il-err)'} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{server.name}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...MONO }}>{server.host}</div>
        </div>
        <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)' }}>{enabled ? ROLE_LABEL[serverRole(server)] : 'Paused'}</span>
        <Chip small on={editing} onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</Chip>
        <IconBtn icon={<IconTrash size={15} />} label={canRemove ? 'Remove server' : 'The last server stays'} size={28} disabled={!canRemove} onClick={() => removeServer(server.id)} />
      </div>
      {editing && <div style={{ marginTop: 8 }}><ServerForm server={server} onDone={() => setEditing(false)} /></div>}
    </div>
  );
}

function AddServer({ count }: { count: number }) {
  const addServer = useStore((s) => s.addServer);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const add = () => {
    if (!host.trim()) return;
    addServer(name.trim() || `Server ${count + 1}`, host.trim());
    setName(''); setHost(''); setOpen(false);
  };
  if (!open) {
    return (
      <div style={{ padding: '10px 0 2px', borderTop: '1px solid var(--il-line)' }}>
        <Chip dashed icon={<IconPlus size={14} stroke={2.6} />} onClick={() => setOpen(true)}>Add server</Chip>
      </div>
    );
  }
  return (
    <div style={{ padding: '10px 0 2px', borderTop: '1px solid var(--il-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Name" aria-label="New server name" size="sm" style={{ flex: '1 1 120px', minWidth: 0 }} styles={inputStyles} />
        <TextInput value={host} onChange={(e) => setHost(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} autoFocus
          placeholder="host:port" aria-label="New server host" size="sm" style={{ flex: '2 1 200px', minWidth: 0 }}
          spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
        <IconBtn icon={<IconPlus size={16} />} label="Add server" tone="primary" size={32} disabled={!host.trim()} onClick={add} />
        <Chip small onClick={() => { setOpen(false); setName(''); setHost(''); }}>Cancel</Chip>
      </div>
    </div>
  );
}

export function ServersList() {
  const servers = useStore((s) => s.servers);
  const up = useServersUp(servers);
  return (
    <div style={{ width: '100%' }}>
      {servers.map((s) => <ServerRow key={s.id} server={s} online={!!up[s.id]} canRemove={servers.length > 1} />)}
      <AddServer count={servers.length} />
    </div>
  );
}

export const SERVERS_ROWS: readonly SettingDef[] = [
  {
    id: 'servers.list', category: 'servers', label: 'ComfyUI servers', wide: true,
    hint: 'Images and video go to the servers marked for them; a /video-comfy host is the video one. Pause a server to keep it without sending it work.',
    keywords: ['comfy', 'host', 'port', 'add server', 'remove', 'pause', 'online', 'offline', 'video', 'images', 'runs', 'role', 'url', 'pod'],
    Control: ServersList,
  },
];
