import {
  ActionIcon, Badge, Box, Button, Group, Paper, Progress, RingProgress, ScrollArea, Stack, Text, Tooltip,
} from '@mantine/core';
import { IconDownload, IconX } from '@tabler/icons-react';
import * as RPopover from '@/components/ui/popover';
import { useDownloadsStore, type DownloadRow } from './store';

/**
 * The downloads panel: a compact nav button that opens a popover listing
 * CivitAI model downloads across every server, with live progress. Polling is
 * driven by `useDownloads`. The ✕ cancels an in-flight download (or dismisses
 * a finished/failed row) on its server.
 *
 * Downloads are fired at every online server, so the same model can appear
 * once per server — each row is tagged with where it's running.
 */
export function DownloadsButton() {
  const rows = useDownloadsStore((s) => s.rows);
  const cancel = useDownloadsStore((s) => s.cancel);
  const aggregate = useDownloadsStore((s) => s.aggregateProgress());

  // Newest first.
  const sorted = [...rows].sort((a, b) => b.started_at - a.started_at);
  const active = sorted.filter((r) => r.status === 'downloading').length;
  const hasError = sorted.some((r) => r.status === 'failed');

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <Button
          variant="default"
          size="compact-sm"
          h={30}
          px={8}
          radius="sm"
          aria-label="Show CivitAI downloads"
          title={
            aggregate !== null
              ? `Downloads — ${Math.round(aggregate * 100)}% (${active} active)`
              : 'Show CivitAI downloads'
          }
          leftSection={<IconDownload size={14} />}
        >
          <CountBadge count={active} progress={aggregate} hasError={hasError} />
        </Button>
      </RPopover.Trigger>

      <RPopover.Portal>
        <RPopover.Content align="center" sideOffset={6}>
          <Paper withBorder shadow="md" radius="md" w={420} maw="92vw" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" px="sm" py={8} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">Downloads</Text>
              <Text size="xs" c="dimmed">
                {active > 0 ? `${active} active` : `${sorted.length} total`}
              </Text>
            </Group>

            {sorted.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" fs="italic" py="lg">No downloads</Text>
            ) : (
              <ScrollArea.Autosize scrollbars="y" mah={360} type="auto">
                <Stack gap={2} p={6}>
                  {sorted.map((row) => (
                    <DownloadRowItem key={row.rowId} row={row} onCancel={() => cancel(row)} />
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Paper>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * Count badge. While anything downloads it becomes a ring tracking aggregate
 * progress (Σ downloaded / Σ total), so a glance at the bar says how close
 * everything is to done; idle, it is a flat badge of the same footprint.
 */
function CountBadge({ count, progress, hasError }: { count: number; progress: number | null; hasError: boolean }) {
  if (progress === null) {
    return (
      <Badge
        size="sm"
        circle={count < 10}
        variant={count > 0 || hasError ? 'filled' : 'light'}
        color={hasError ? 'red' : count > 0 ? undefined : 'gray'}
      >
        {count}
      </Badge>
    );
  }
  return (
    <RingProgress
      size={22}
      thickness={2}
      roundCaps
      sections={[{ value: progress * 100, color: hasError ? 'red' : 'var(--mantine-primary-color-filled)' }]}
      label={<Text fz={9} fw={600} ta="center" lh={1}>{count}</Text>}
    />
  );
}

/** Per-second throughput, shown alongside the bytes counter while a file
 *  is in-flight. MB/s for anything ≥ 1 MB/s (the common case for fast NICs),
 *  KB/s below — keeps the number short. */
function fmtSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

/** v1 JobStatusBadge colours, applied to download states. */
const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  downloading: { color: 'blue', label: 'downloading' },
  completed: { color: 'green', label: 'done' },
  failed: { color: 'red', label: 'failed' },
  cancelled: { color: 'gray', label: 'cancelled' },
};

function DownloadRowItem({ row, onCancel }: { row: DownloadRow; onCancel: () => void }) {
  const bps = useDownloadsStore((s) => s.bytesPerSecond(row.rowId));

  const speed = row.status === 'downloading' ? fmtSpeed(bps) : '';
  const statusLabel =
    row.status === 'failed' ? (row.error || 'Failed')
    : row.status === 'completed' ? 'Done'
    : row.status === 'cancelled' ? 'Cancelled'
    : row.total_bytes > 0
      ? `${fmtBytes(row.downloaded_bytes)} / ${fmtBytes(row.total_bytes)}${speed ? ` · ${speed}` : ''}`
      : speed ? `Starting… · ${speed}` : 'Starting…';

  const cancelLabel = row.status === 'downloading' ? 'Cancel download' : 'Dismiss';
  const badge = STATUS_BADGE[row.status] ?? { color: 'gray', label: row.status };
  const badgeLabel = row.status === 'downloading' && row.total_bytes > 0 ? `${row.percent}%` : badge.label;

  return (
    <Box
      px={8}
      py={6}
      style={{ borderRadius: 'var(--mantine-radius-sm)', backgroundColor: 'var(--mantine-color-dark-6)' }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" truncate>{row.filename}</Text>
          <Text
            fz={10}
            lh={1.35}
            c={row.status === 'failed' ? 'red.4' : 'dimmed'}
            style={{ wordBreak: 'break-word' }}
          >
            {row.serverName} · {row.folder} · {statusLabel}
          </Text>
        </Box>
        <Badge size="xs" variant="filled" color={badge.color}>{badgeLabel}</Badge>
        <Tooltip label={cancelLabel} withinPortal fz="xs">
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={cancelLabel} onClick={onCancel}>
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {row.status === 'downloading' && (
        row.total_bytes > 0
          ? <Progress value={row.percent} size="xs" color="blue" animated mt={6} />
          : <Progress value={100} size="xs" color="blue" striped animated mt={6} opacity={0.4} />
      )}
    </Box>
  );
}
