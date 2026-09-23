import { useEffect, useState } from 'react';
import { Stack, Group, Paper, TextInput, Switch, ActionIcon, Button, Badge, Tooltip } from '@mantine/core';
import { IconServer, IconPlus, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Server } from '@/lib/storage';
import { SettingsSection } from './SettingsSection';

/**
 * Servers tab — add / edit / remove ComfyUI endpoints. All workflow state is
 * global; this only controls *where* jobs are routed.
 */
export function ServersTab() {
  const servers = useStore(s => s.servers);
  const serverInfo = useStore(s => s.serverInfo);
  const addServer = useStore(s => s.addServer);
  const updateServer = useStore(s => s.updateServer);
  const removeServer = useStore(s => s.removeServer);

  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');

  const add = () => {
    if (!newHost.trim()) return;
    addServer(newName || `Server ${servers.length + 1}`, newHost);
    setNewName('');
    setNewHost('');
  };

  return (
    <Stack gap="lg">
      <SettingsSection
        title="Active Servers"
        description="Each server is a ComfyUI endpoint. All parameters, models, prompt and history are shared — jobs are spread across servers by the routing control on the Generate button (round-robin, or pinned to one server)."
      >
        <Stack gap="sm">
          {servers.map(s => (
            <ServerRow
              key={s.id}
              server={s}
              online={!!serverInfo[s.id]}
              canRemove={servers.length > 1}
              onUpdate={(patch) => updateServer(s.id, patch)}
              onRemove={() => removeServer(s.id)}
              onToggleEnabled={(on) => updateServer(s.id, { enabled: on })}
            />
          ))}
        </Stack>
      </SettingsSection>

      <SettingsSection title="Add Server" description="Connect another ComfyUI endpoint on your network or a pod.">
        <Group grow align="flex-start">
          <TextInput
            label="Name"
            placeholder="Name (e.g. Server 3)"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
          <TextInput
            label="Host"
            placeholder="host:port (e.g. 192.168.0.23:8188)"
            leftSection={<IconServer size={16} />}
            value={newHost}
            onChange={(e) => setNewHost(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          />
        </Group>
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={add} disabled={!newHost.trim()}>
            Add server
          </Button>
        </Group>
      </SettingsSection>
    </Stack>
  );
}

/**
 * One editable server row. Name/host are kept in local draft state and
 * committed on blur (or Enter) so editing a host doesn't tear down its
 * websocket on every keystroke.
 */
function ServerRow({
  server, online, canRemove, onUpdate, onRemove, onToggleEnabled,
}: {
  server: Server;
  online: boolean;
  canRemove: boolean;
  onUpdate: (patch: Partial<Pick<Server, 'name' | 'host'>>) => void;
  onRemove: () => void;
  onToggleEnabled: (on: boolean) => void;
}) {
  const enabled = server.enabled !== false;
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  useEffect(() => { setName(server.name); }, [server.name]);
  useEffect(() => { setHost(server.host); }, [server.host]);

  const commitName = () => { if (name.trim() && name !== server.name) onUpdate({ name }); else setName(server.name); };
  const commitHost = () => { if (host.trim() && host !== server.host) onUpdate({ host }); else setHost(server.host); };

  const status = !enabled
    ? { label: 'Disabled', color: 'gray' }
    : online ? { label: 'Online', color: 'green' } : { label: 'Offline', color: 'red' };

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{ backgroundColor: 'var(--mantine-color-dark-6)', opacity: enabled ? 1 : 0.6, transition: 'opacity 150ms ease' }}
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <TextInput
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="Server name"
            aria-label="Server name"
            variant="unstyled"
            fw={600}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Badge
            variant="light"
            color={status.color}
            title={!enabled ? 'Disabled' : online ? 'Online' : 'Offline / unreachable'}
          >
            {status.label}
          </Badge>
          <Switch
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.currentTarget.checked)}
            aria-label={enabled ? 'Disable server' : 'Enable server'}
          />
          <Tooltip label={canRemove ? 'Remove server' : 'Can’t remove the last server'} withinPortal>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={onRemove}
              disabled={!canRemove}
              aria-label="Remove server"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <TextInput
          value={host}
          onChange={(e) => setHost(e.currentTarget.value)}
          onBlur={commitHost}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="host:port"
          aria-label="Server host"
          leftSection={<IconServer size={16} />}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />
      </Stack>
    </Paper>
  );
}
