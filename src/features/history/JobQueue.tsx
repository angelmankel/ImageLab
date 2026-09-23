import { memo, useMemo } from 'react';
import { ActionIcon, Box, Group, Loader, Progress, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import type { Job } from '@/lib/types';
import { JobStatusBadge, jobPercent } from './JobStatusBadge';

const TILE_SIZE = 80;

/**
 * v1's JobQueue: a horizontal row of square tiles above the history grid, one
 * per queued / running / failed job, newest on the left. A running tile shows
 * its server's live preview under a progress bar; failed jobs stay until their
 * ✕ dismisses them, as they do in the queue popover.
 */
export function JobQueue() {
  const jobs = useStore(s => s.jobs);
  const servers = useStore(s => s.servers);
  const cancelJob = useStore(s => s.cancelJob);
  const livePreviews = useCanvasStore(s => s.livePreviews);

  const sorted = useMemo(() => [...jobs].sort((a, b) => b.createdAt - a.createdAt), [jobs]);
  if (sorted.length === 0) return null;

  const serverName = (id: string) => servers.find(sv => sv.id === id)?.name ?? '?';

  return (
    <Box px={8} py={8} style={{ borderBottom: '1px solid var(--mantine-color-dark-4)', flexShrink: 0 }}>
      <Group gap="xs" wrap="nowrap" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        {sorted.map(job => (
          <JobTile
            key={job.id}
            job={job}
            serverName={serverName(job.serverId)}
            previewUrl={job.status === 'running' ? livePreviews[job.serverId] : undefined}
            onCancel={() => cancelJob(job.id)}
          />
        ))}
      </Group>
    </Box>
  );
}

const JobTile = memo(function JobTile({
  job, serverName, previewUrl, onCancel,
}: {
  job: Job;
  serverName: string;
  previewUrl?: string;
  onCancel: () => void;
}) {
  const isRunning = job.status === 'running';
  const isError = job.status === 'error';
  const pct = jobPercent(job);
  const cancelLabel = isRunning ? 'Interrupt job' : job.status === 'queued' ? 'Remove from queue' : 'Dismiss job';
  const detail = isError ? (job.error || 'Failed') : isRunning ? (job.node ? `Running · ${job.node}` : 'Running') : 'Queued';

  return (
    <Tooltip
      withinPortal
      multiline
      w={240}
      fz="xs"
      openDelay={300}
      label={
        <>
          <Text size="xs" lineClamp={3}>{job.positive || '(no prompt)'}</Text>
          <Text fz={10} c="dimmed">{serverName} · {detail}</Text>
        </>
      }
    >
      <Box
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--mantine-radius-sm)',
          border: `2px solid var(--mantine-color-${isError ? 'red' : 'blue'}-6)`,
          backgroundColor: 'var(--mantine-color-dark-6)',
        }}
      >
        {isRunning && (
          <Progress
            value={pct ?? 100}
            size={4}
            color="blue"
            animated
            striped={pct === null}
            radius={0}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
          />
        )}

        <ActionIcon
          size="xs"
          variant="filled"
          color="dark"
          aria-label={cancelLabel}
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          style={{ position: 'absolute', top: isRunning ? 8 : 4, right: 4, zIndex: 10, opacity: 0.8 }}
        >
          <IconX size={10} />
        </ActionIcon>

        <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Live preview"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : isError ? (
            <IconAlertTriangle size={22} color="var(--mantine-color-red-5)" />
          ) : (
            <Loader size="sm" color="blue" />
          )}
        </Box>

        <Box style={{ position: 'absolute', left: 4, bottom: 4, zIndex: 10 }}>
          <JobStatusBadge job={job} />
        </Box>
      </Box>
    </Tooltip>
  );
});
