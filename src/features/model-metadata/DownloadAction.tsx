import { Button, Menu, Text } from '@mantine/core';
import { IconCheck, IconChevronDown, IconDownload } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { useDownloadsStore } from '@/features/downloads';
import { primaryFile, type CivitaiModelVersion } from './civitai';

/**
 * Footer action for the metadata modal. Two parts:
 *
 *   ┌───────────────────────────────┬─────┐
 *   │  Download / Sync to N / On... │  ▼  │
 *   └───────────────────────────────┴─────┘
 *
 *   • Main button:   fires the "default" action — download on every online
 *                    server that doesn't have it (the round-robin sweet spot).
 *   • Chevron menu:  per-server list. Each row shows the server's current
 *                    state and lets you trigger a download against just that
 *                    one server — useful when you only want the model on
 *                    your fast box, or you're testing a pod.
 *
 * Per-server presence is matched by the version's primary file name against
 * each server's reported model lists — the same basis as <FileDetails>.
 */
export function DownloadAction({ version }: { version: CivitaiModelVersion }) {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const rows = useDownloadsStore((s) => s.rows);
  const start = useDownloadsStore((s) => s.start);

  const fileName = primaryFile(version)?.name ?? '';
  const online = servers.filter((s) => serverInfo[s.id]);
  const haveIds = new Set(serversWithModel(serverInfo, fileName));
  const missing = online.filter((s) => !haveIds.has(s.id));
  // Per-server live download state — keyed by both versionId AND serverId so
  // a download running on server A doesn't make server B's row look busy.
  const isDownloadingOn = (serverId: string) =>
    rows.some(
      (r) => r.version_id === version.id && r.serverId === serverId && r.status === 'downloading',
    );
  const anyDownloading = rows.some(
    (r) => r.version_id === version.id && r.status === 'downloading',
  );

  if (online.length === 0) {
    return <Button size="xs" variant="default" disabled>No servers online</Button>;
  }

  // Main-button label/state.
  let mainLabel: string;
  let mainDisabled = false;
  let mainAction: (() => void) | null = null;
  let mainTone: 'idle' | 'accent' | 'ok' = 'idle';
  if (anyDownloading) {
    mainLabel = 'Downloading…';
    mainDisabled = true;
    mainTone = 'idle';
  } else if (missing.length === 0) {
    mainLabel = 'On disk';
    mainDisabled = true;
    mainTone = 'ok';
  } else if (haveIds.size > 0) {
    mainLabel = `Sync to ${missing.length} server${missing.length === 1 ? '' : 's'}`;
    mainAction = () => void start(version.id, undefined, missing.map((s) => s.id));
    mainTone = 'accent';
  } else {
    mainLabel = 'Download';
    mainAction = () => void start(version.id);
    mainTone = 'idle';
  }

  return (
    <Button.Group>
      <Button
        size="xs"
        variant={mainTone === 'idle' ? 'default' : 'light'}
        color={mainTone === 'ok' ? 'green' : undefined}
        onClick={mainAction ?? undefined}
        // "On disk" is a status, not an action: shown green and inert rather than greyed out.
        disabled={mainDisabled && mainTone !== 'ok'}
        style={mainTone === 'ok' ? { cursor: 'default' } : undefined}
        title={
          mainLabel.startsWith('Sync')
            ? `Missing on: ${missing.map((s) => s.name).join(', ')}`
            : undefined
        }
        leftSection={mainTone === 'ok' ? <IconCheck size={13} /> : <IconDownload size={13} />}
      >
        {mainLabel}
      </Button>

      <ServerDropdown
        servers={online}
        haveIds={haveIds}
        isDownloadingOn={isDownloadingOn}
        onPick={(serverId) => void start(version.id, undefined, [serverId])}
      />
    </Button.Group>
  );
}

/**
 * Split-button chevron. Opens a menu with one row per online server so
 * the user can fire a download at a specific box without disturbing the
 * others. Disabled when there's only one server online — the main
 * button already does the right thing in that case.
 */
function ServerDropdown({
  servers, haveIds, isDownloadingOn, onPick,
}: {
  servers: { id: string; name: string }[];
  haveIds: Set<string>;
  isDownloadingOn: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  if (servers.length <= 1) {
    return (
      <Button size="xs" px={8} variant="default" disabled aria-label="Download to a specific server">
        <IconChevronDown size={12} />
      </Button>
    );
  }
  return (
    <Menu position="top-end" withinPortal width={260} shadow="md">
      <Menu.Target>
        <Button
          size="xs"
          px={8}
          variant="default"
          aria-label="Download to a specific server"
          title="Download to a specific server"
        >
          <IconChevronDown size={12} />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Download to one server</Menu.Label>
        {servers.map((s) => {
          const has = haveIds.has(s.id);
          const busy = isDownloadingOn(s.id);
          return (
            <Menu.Item
              key={s.id}
              disabled={has || busy}
              onClick={() => onPick(s.id)}
              leftSection={
                has
                  ? <IconCheck size={13} color="var(--mantine-color-green-5)" />
                  : <IconDownload size={13} className={busy ? 'animate-pulse text-yellow-400' : undefined} />
              }
              rightSection={
                <Text size="10px" c="dimmed">{has ? 'on disk' : busy ? 'downloading' : 'missing'}</Text>
              }
            >
              {s.name}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
