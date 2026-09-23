import { ActionIcon, Badge, Box, Button, Group, Loader, Paper, Progress, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconStack2, IconX } from '@tabler/icons-react';
import * as RPopover from '@/components/ui/popover';
import { useStore } from '@/lib/store';
import { JobStatusBadge, jobPercent } from '@/features/history/JobStatusBadge';
import type { Job } from '@/lib/types';

/**
 * The generation queue: a compact nav button that opens a popover listing jobs
 * across every server, with live status + progress. Jobs persist in IndexedDB,
 * so this survives a refresh; completed jobs drop off on their own, errored
 * ones stay until dismissed. The ✕ cancels the job on its ComfyUI server
 * (interrupt if running, dequeue if pending) and removes it here.
 */
export function QueueButton() {
  const jobs = useStore(s => s.jobs);
  const servers = useStore(s => s.servers);
  const cancelJob = useStore(s => s.cancelJob);

  // Newest first, across all servers.
  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);
  const count = sorted.length;
  const hasError = sorted.some(j => j.status === 'error');
  const serverName = (id: string) => servers.find(sv => sv.id === id)?.name ?? '?';

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <Button
          variant="default"
          size="compact-sm"
          h={30}
          px={8}
          radius="sm"
          title="Show the generation queue"
          leftSection={<IconStack2 size={14} />}
          rightSection={
            <Badge
              size="sm"
              circle={count < 10}
              variant={count > 0 || hasError ? 'filled' : 'light'}
              color={hasError ? 'red' : count > 0 ? undefined : 'gray'}
            >
              {count}
            </Badge>
          }
          styles={{ label: { fontSize: 11, fontWeight: 500 } }}
        >
          Queue
        </Button>
      </RPopover.Trigger>

      <RPopover.Portal>
        <RPopover.Content align="center" sideOffset={6}>
          <Paper withBorder shadow="md" radius="md" w={340} style={{ overflow: 'hidden' }}>
            <Group justify="space-between" px="sm" py={8} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">Queue</Text>
              <Text size="xs" c="dimmed">{count} job{count === 1 ? '' : 's'}</Text>
            </Group>

            {count === 0 ? (
              <Text size="xs" c="dimmed" ta="center" fs="italic" py="lg">No active jobs</Text>
            ) : (
              <ScrollArea.Autosize scrollbars="y" mah={340} type="auto">
                <Stack gap={2} p={6}>
                  {sorted.map(job => (
                    <JobRow
                      key={job.id}
                      job={job}
                      serverName={serverName(job.serverId)}
                      onCancel={() => cancelJob(job.id)}
                    />
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

function JobRow({
  job, serverName, onCancel,
}: {
  job: Job;
  serverName: string;
  onCancel: () => void;
}) {
  const pct = jobPercent(job);

  const nodeCounter = job.totalNodes
    ? `${Math.min(job.executedNodes ?? 0, job.totalNodes)}/${job.totalNodes}`
    : null;

  const runningLabel = job.node
    ? `Running · ${nodeCounter ? `node ${nodeCounter} · ` : ''}${job.node}`
    : 'Running';
  const statusLabel =
    job.status === 'error' ? (job.error || 'Failed')
    : job.status === 'running' ? runningLabel
    : 'Queued';

  const cancelLabel =
    job.status === 'running' ? 'Interrupt job'
    : job.status === 'queued' ? 'Remove from queue'
    : 'Dismiss job';

  return (
    <Box
      px={8}
      py={6}
      style={{ borderRadius: 'var(--mantine-radius-sm)', backgroundColor: 'var(--mantine-color-dark-6)' }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        {job.status === 'running' && <Loader size={12} mt={3} color="blue" />}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" truncate>{job.positive || '(no prompt)'}</Text>
          <Text
            fz={10}
            c={job.status === 'error' ? 'red.4' : 'dimmed'}
            truncate={job.status !== 'error'}
            style={job.status === 'error' ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : undefined}
            title={job.status === 'error' ? statusLabel : undefined}
          >
            {serverName} · #{job.id.slice(0, 6)} · {statusLabel}
          </Text>
        </Box>
        <JobStatusBadge job={job} />
        <Tooltip label={cancelLabel} withinPortal fz="xs">
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={cancelLabel} onClick={onCancel}>
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {job.status === 'running' && (
        pct !== null
          ? <Progress value={pct} size="xs" color="blue" animated mt={6} />
          : <Progress value={100} size="xs" color="blue" striped animated mt={6} opacity={0.4} />
      )}
    </Box>
  );
}
