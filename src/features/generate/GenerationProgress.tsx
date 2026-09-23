import { Alert, Anchor, Group, Progress, Stack, Text } from '@mantine/core';
import { useStore } from '@/lib/store';
import { useMemo } from 'react';
import { jobActivity } from '@/lib/jobActivity';
import { jobStages } from '@/lib/pipeline';

/**
 * Status line + v1 progress bar under the generate controls. Before the first
 * sampler step there is no percent, so the bar runs full, striped and faded
 * rather than pretending to a number.
 */
export function GenerationProgress() {
  const jobs = useStore(s => s.jobs);
  const submitting = useStore(s => s.isSubmitting);
  const serverInfo = useStore(s => s.serverInfo);
  const status = useStore(s => s.status);
  const activity = jobActivity(jobs, submitting, Object.keys(serverInfo).length > 0);
  const known = activity.percent !== null;
  // "Step 2/4 · Loopback 1": where the running job is among its base image, Loopback rounds and passes.
  const running = jobs.find(j => j.status === 'running');
  const plan = useMemo(() => running ? jobStages(running.workflow, !!running.resultCrop) : null, [running?.workflow, running?.resultCrop]); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = running && plan && plan.total > 1 ? Math.min(running.stage ?? 1, plan.total) : null;
  return (
    <Stack gap={6} aria-live="polite">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={500} truncate>
          {stage && plan && (
            <Text span size="xs" fw={700} c="var(--mantine-primary-color-filled)" mr={6} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {stage}/{plan.total}
            </Text>
          )}
          {stage && plan ? plan.names[stage - 1] : activity.label}{known && ` · ${activity.percent}%`}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {activity.queued > 0 ? `${activity.queued} queued` : known ? activity.detail : ''}
        </Text>
      </Group>
      {activity.active && (
        // The aria lives on the root so the unknown-percent state reads as the activity, not "100%".
        <Progress.Root
          size="sm"
          role="progressbar"
          aria-label={known ? 'Current sampling pass' : activity.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={activity.percent ?? undefined}
          aria-valuetext={known ? activity.detail : activity.label}
        >
          <Progress.Section
            withAria={false}
            value={known ? activity.percent! : 100}
            animated
            striped={!known}
            style={known ? undefined : { opacity: 0.5 }}
          />
        </Progress.Root>
      )}
      {status.kind === 'error' && (
        <Alert role="alert" color="red" variant="light" p="xs" styles={{ message: { fontSize: 12 } }}>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <Text size="xs" style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{status.text}</Text>
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="red.4"
              underline="always"
              onClick={() => useStore.getState().setStatus('Ready', 'ok')}
            >
              Dismiss
            </Anchor>
          </Group>
        </Alert>
      )}
    </Stack>
  );
}
