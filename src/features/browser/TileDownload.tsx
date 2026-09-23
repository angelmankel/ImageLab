/**
 * Download control on a model-browser tile:
 *
 *   ┌──────────────┬───┐
 *   │ ↓ Download   │ ▼ │
 *   └──────────────┴───┘
 *
 * The main button downloads the version the tile is previewing (the one whose sample image is on
 * show). The chevron opens a list of every version — name, base model, file size, and whether it
 * is already on disk — and a click on one downloads it. Downloads go to every online server that
 * lacks the file, as the metadata modal's main button does.
 */
import { useState } from 'react';
import { Badge, Button, Group, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown, IconDownload, IconLoader2 } from '@tabler/icons-react';
import * as Popover from '@/components/ui/popover';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { useDownloadsStore } from '@/features/downloads';
import { primaryFile } from '@/features/model-metadata/civitai';
import type { CivitaiModelVersion } from '@/lib/civitai';

type VersionState = 'download' | 'sync' | 'on-disk' | 'downloading';

function useVersionState() {
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);
  const rows = useDownloadsStore((s) => s.rows);
  const start = useDownloadsStore((s) => s.start);
  const online = servers.filter((s) => serverInfo[s.id]);

  const stateOf = (v: CivitaiModelVersion): { state: VersionState; missing: string[] } => {
    const have = new Set(serversWithModel(serverInfo, primaryFile(v)?.name ?? ''));
    const missing = online.filter((s) => !have.has(s.id)).map((s) => s.id);
    if (rows.some((r) => r.version_id === v.id && r.status === 'downloading')) return { state: 'downloading', missing };
    if (missing.length === 0) return { state: 'on-disk', missing };
    return { state: have.size > 0 ? 'sync' : 'download', missing };
  };
  const download = (v: CivitaiModelVersion) => {
    const { state, missing } = stateOf(v);
    if (state === 'on-disk' || state === 'downloading') return;
    void start(v.id, undefined, state === 'sync' ? missing : undefined);
  };
  return { online: online.length, stateOf, download };
}

function formatSize(kb?: number): string {
  if (!kb) return '';
  const mb = kb / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

const LABEL: Record<VersionState, string> = { download: 'Download', sync: 'Sync', 'on-disk': 'On disk', downloading: 'Downloading…' };

export function TileDownload({ versions, previewVersionId }: { versions: CivitaiModelVersion[]; previewVersionId?: number }) {
  const [open, setOpen] = useState(false);
  const { online, stateOf, download } = useVersionState();
  if (versions.length === 0) return null;
  const preview = versions.find((v) => v.id === previewVersionId) ?? versions[0];
  const { state } = stateOf(preview);
  const noServer = online === 0;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    // The tile itself opens the model on click; nothing in here may bubble up to it.
    <div onClick={stop} onKeyDown={stop} onPointerDown={stop}>
      <Button.Group w="100%">
        <Button
          size="compact-xs"
          variant={state === 'on-disk' ? 'light' : 'default'}
          color={state === 'on-disk' ? 'green' : undefined}
          style={{ flex: 1, minWidth: 0 }}
          leftSection={state === 'on-disk' ? <IconCheck size={12} /> : state === 'downloading' ? <IconLoader2 size={12} className="animate-spin" /> : <IconDownload size={12} />}
          disabled={noServer || state === 'downloading'}
          onClick={() => download(preview)}
          title={noServer ? 'No servers online' : `${LABEL[state]} ${preview.name}`}
          aria-label={`${LABEL[state]} ${preview.name}`}
        >
          <Text span size="xs" truncate>{noServer ? 'No servers' : `${LABEL[state]} · ${preview.name}`}</Text>
        </Button>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <Button size="compact-xs" variant="default" px={6} disabled={noServer} aria-label="Choose a version to download">
              <IconChevronDown size={12} />
            </Button>
          </Popover.Trigger>
          <Popover.Content
            side="bottom"
            align="end"
            className="w-[280px] overflow-hidden rounded-md border border-border-default bg-bg-elev shadow-xl"
          >
            <div onClick={stop} onPointerDown={stop}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" pt="xs" pb={4}>Versions</Text>
              <ScrollArea.Autosize scrollbars="y" mah={320} type="auto">
                <Stack gap={2} p={4}>
                  {versions.map((v) => {
                    const s = stateOf(v).state;
                    const file = primaryFile(v);
                    const inert = s === 'on-disk' || s === 'downloading';
                    return (
                      <UnstyledButton
                        key={v.id}
                        onClick={() => { download(v); setOpen(false); }}
                        disabled={inert}
                        className="rounded px-2 py-1.5 hover:bg-bg-card-on disabled:cursor-default disabled:hover:bg-transparent"
                        aria-label={`${LABEL[s]} version ${v.name}`}
                      >
                        <Group justify="space-between" wrap="nowrap" gap="xs">
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Text size="xs" fw={v.id === preview.id ? 700 : 500} truncate>{v.name}</Text>
                            <Text size="10px" c="dimmed" truncate>
                              {[v.baseModel, formatSize(file?.sizeKB)].filter(Boolean).join(' · ')}
                            </Text>
                          </Stack>
                          {s === 'on-disk' ? <Badge size="xs" color="green" variant="light">On disk</Badge>
                            : s === 'downloading' ? <Badge size="xs" variant="light">Downloading</Badge>
                            : <IconDownload size={14} style={{ flexShrink: 0, opacity: 0.7 }} />}
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              </ScrollArea.Autosize>
            </div>
          </Popover.Content>
        </Popover.Root>
      </Button.Group>
    </div>
  );
}
