/**
 * Settings → Servers: add / rename / re-point / pause / remove ComfyUI servers and say what each
 * runs (Images + video · Images · Video). Logic = `@/lib/store` (addServer, updateServer,
 * removeServer) and `@/lib/serverRoles`, as in the classic Settings → Servers tab. Name and host
 * commit on blur / Enter so typing a host does not reconnect on every key.
 */
import { useEffect, useState } from 'react';
import { Switch as MSwitch, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { serverRole, type ServerRole } from '@/lib/serverRoles';
import type { Server } from '@/lib/storage';
import { Dot, IconBtn, Tabs } from '~/ui';
import { inputStyles, monoInputStyles, SettingsCard } from './SettingsCard';
import { useServersUp } from './useServersUp';

function ServerEdit({ server, online, canRemove }: { server: Server; online: boolean; canRemove: boolean }) {
  const updateServer = useStore((s) => s.updateServer);
  const removeServer = useStore((s) => s.removeServer);
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  useEffect(() => setName(server.name), [server.name]);
  useEffect(() => setHost(server.host), [server.host]);
  const enabled = server.enabled !== false;

  const commitName = () => { if (name.trim() && name !== server.name) updateServer(server.id, { name: name.trim() }); else setName(server.name); };
  const commitHost = () => { if (host.trim() && host !== server.host) updateServer(server.id, { host: host.trim() }); else setHost(server.host); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 12, background: 'var(--il-elev)', opacity: enabled ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span title={!enabled ? 'Paused' : online ? 'Online' : 'Offline'} style={{ display: 'grid', placeItems: 'center', width: 14 }}>
          <Dot color={!enabled ? 'var(--il-dim)' : online ? 'var(--il-ok)' : 'var(--il-err)'} />
        </span>
        <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label="Server name" variant="unstyled" size="sm" style={{ flex: 1, minWidth: 0 }}
          styles={{ input: { fontWeight: 800, fontSize: 13, color: 'var(--il-fg)' } }} />
        <MSwitch checked={enabled} onChange={(e) => updateServer(server.id, { enabled: e.currentTarget.checked })}
          color="ember" size="sm" aria-label={enabled ? 'Pause this server' : 'Use this server'} />
        <IconBtn icon={<IconTrash size={15} />} label={canRemove ? 'Remove server' : 'The last server stays'} size={30}
          disabled={!canRemove} onClick={() => removeServer(server.id)} />
      </div>
      <TextInput value={host} onChange={(e) => setHost(e.currentTarget.value)} onBlur={commitHost}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        aria-label="Server host" placeholder="host:port or host:port/video-comfy" size="sm"
        spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
      <Tabs<ServerRole>
        compact
        value={serverRole(server)}
        onChange={(role) => updateServer(server.id, { role })}
        items={[{ key: 'both', label: 'Images + video' }, { key: 'image', label: 'Images' }, { key: 'video', label: 'Video' }]}
      />
    </div>
  );
}

export function ServersCard() {
  const servers = useStore((s) => s.servers);
  const up = useServersUp(servers);
  const addServer = useStore((s) => s.addServer);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const add = () => {
    if (!host.trim()) return;
    addServer(name.trim() || `Server ${servers.length + 1}`, host.trim());
    setName(''); setHost('');
  };

  return (
    <SettingsCard title="Servers" description="ComfyUI servers. Images and video go to the servers marked for them; a /video-comfy host is the video one.">
      {servers.map((s) => <ServerEdit key={s.id} server={s} online={!!up[s.id]} canRemove={servers.length > 1} />)}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Name" aria-label="New server name" size="sm" style={{ width: '34%' }} styles={inputStyles} />
        <TextInput value={host} onChange={(e) => setHost(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="host:port" aria-label="New server host" size="sm" style={{ flex: 1, minWidth: 0 }}
          spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
        <IconBtn icon={<IconPlus size={16} />} label="Add server" tone="primary" size={32} disabled={!host.trim()} onClick={add} />
      </div>
    </SettingsCard>
  );
}
