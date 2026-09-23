/**
 * Studio — build the workflow in ComfyUI, drive it from here.
 *
 * A second UI beside the generate view, not a replacement for it. The generate view knows one
 * pipeline very well; Studio knows none, and reads whatever workflow it is given. The two share
 * components, the server list and the comfy client, and share no state at all.
 *
 * Focus mode is the reason it exists: once the few controls that matter are pinned, ComfyUI is
 * hidden and what is left is a picture, some knobs and a button. That mode is the default on a
 * phone, where a node graph was never going to be usable anyway.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import {
  Button, Group, Indicator, Loader, SegmentedControl, Stack, Switch, Text, Tooltip,
} from '@mantine/core';
import { IconExternalLink, IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-react';
import { ParamList, PromptPanel, ResetAllButton, ResultView, WorkflowPicker } from './StudioPanels';
import { StudioMobile } from './StudioMobile';
import { useObjectInfo, useStudioRun } from './useStudioRun';
import { useWorkflowLibrary } from './useWorkflowLibrary';
import { useStudio } from './studioStore';

/** The host Studio talks to: the server the person last chose, else the first enabled one. */
export function useStudioHost(): string | null {
  const servers = useStore(s => s.servers);
  const pinned = useCanvasStore(s => s.comfyServerId);
  const server = servers.find(s => s.id === pinned && s.enabled !== false)
    ?? servers.find(s => s.enabled !== false)
    ?? servers[0];
  return server?.host ?? null;
}

export function StudioView() {
  const host = useStudioHost();
  const isDesktop = useIsDesktop();
  const { info, error: infoError } = useObjectInfo(host);
  const library = useWorkflowLibrary(host, info);
  const run = useStudioRun(host, info);

  if (!host) {
    return <Dead title="No ComfyUI server" body="Add one in Settings, then come back." />;
  }
  if (infoError) {
    return <Dead title="Cannot reach ComfyUI" body={infoError} />;
  }
  if (!info) {
    return <Dead title="Reading the server…" body="Fetching the node catalogue." />;
  }

  return isDesktop
    ? <StudioDesktop library={library} run={run} host={host} />
    : <StudioMobile library={library} run={run} host={host} />;
}

type Library = ReturnType<typeof useWorkflowLibrary>;
type Run = ReturnType<typeof useStudioRun>;

function StudioDesktop({ library, run, host }: { library: Library; run: Run; host: string | null }) {
  const mode = useStudio(s => s.mode);
  const setMode = useStudio(s => s.setMode);
  const focusMode = useStudio(s => s.focusMode);
  const setFocusMode = useStudio(s => s.setFocusMode);
  const path = useStudio(s => s.path);
  const setMainView = useCanvasStore(s => s.setMainView);
  const paramCount = useStudio(s => s.params.length);

  return (
    <div className="flex h-full min-h-0">
      {/* Workflows */}
      <aside className="flex w-[260px] shrink-0 flex-col gap-3 border-r border-border-subtle p-3">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={600}>Workflows</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconRefresh size={12} />} onClick={library.refresh}>
            Refresh
          </Button>
        </Group>
        <div className="scroll-y min-h-0 flex-1">
          <WorkflowPicker workflows={library.workflows} onOpen={library.open} onRefresh={library.refresh} />
        </div>
        <Stack gap="xs" component="footer" className="border-t border-border-subtle pt-3">
          <Switch
            size="sm"
            label="Focus mode"
            labelPosition="left"
            checked={focusMode}
            onChange={e => setFocusMode(e.currentTarget.checked)}
            classNames={{ body: 'justify-between', labelWrapper: 'flex-1' }}
            description="Hides ComfyUI from the sidebar so this is the only place to be."
          />
          {!focusMode && (
            <Button variant="default" size="xs" fullWidth rightSection={<IconExternalLink size={13} />} onClick={() => setMainView('comfy')}>
              Open ComfyUI
            </Button>
          )}
        </Stack>
      </aside>

      {/* Image */}
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <ResultView
          results={run.results}
          latest={run.latest}
          busy={run.busy}
          status={run.status}
          progress={run.progress}
          currentNode={run.currentNode}
          preview={run.preview}
          queueRemaining={run.queueRemaining}
        />
        {run.error && <Text size="xs" c="red.4" className="shrink-0">{run.error}</Text>}
      </main>

      {/* Controls */}
      <aside className="flex w-[380px] shrink-0 flex-col border-l border-border-subtle">
        <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle p-3">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={v => setMode(v as typeof mode)}
            data={[{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }]}
          />
          <Group gap={8} wrap="nowrap" className="min-w-0 flex-1">
            <Tooltip label={run.connected ? 'Live — connected to ComfyUI' : 'Socket down'} withArrow>
              <Indicator color={run.connected ? 'green' : 'red'} size={7} position="middle-center" processing={run.connected}>
                <span className="block h-2 w-2" />
              </Indicator>
            </Tooltip>
            <Text size="xs" c="dimmed" truncate>
              {path ? `${paramCount} control${paramCount === 1 ? '' : 's'}` : 'nothing open'}
            </Text>
          </Group>
          <ResetAllButton />
        </header>

        <div className="scroll-y flex min-h-0 flex-1 flex-col gap-4 px-3 py-3">
          <PromptPanel />
          <ParamList host={host} />
        </div>

        <footer className="shrink-0 border-t border-border-subtle p-3">
          <GenerateBar run={run} />
        </footer>
      </aside>
    </div>
  );
}

export function GenerateBar({ run, large }: { run: Run; large?: boolean }) {
  const path = useStudio(s => s.path);
  const disabled = !path || run.busy;
  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        // The sidebar's view switcher is also called "Generate". Distinct labels keep the two
        // apart for a screen reader, and for anything driving the UI by name.
        aria-label="Generate image"
        onClick={() => void run.run()}
        disabled={disabled}
        fullWidth
        size={large ? 'lg' : 'md'}
        leftSection={run.busy ? <Loader size="xs" color="white" /> : <IconPlayerPlay size="1rem" />}
        className="flex-1"
      >
        {run.busy ? (run.status ?? 'Working…') : 'Generate'}
      </Button>
      {run.busy && (
        <Button
          variant="default"
          size={large ? 'lg' : 'md'}
          leftSection={<IconPlayerStop size="1rem" />}
          onClick={() => void run.cancel()}
          className="shrink-0"
        >
          Stop
        </Button>
      )}
    </Group>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <Stack h="100%" align="center" justify="center" gap={6} px="xl" ta="center">
      <Text size="sm" fw={500}>{title}</Text>
      <Text size="xs" c="dimmed">{body}</Text>
    </Stack>
  );
}

/** Memo-friendly export used by the sidebar to decide whether to offer ComfyUI at all. */
export function useFocusMode() {
  const focusMode = useStudio(s => s.focusMode);
  const isDesktop = useIsDesktop();
  // On a phone, focus mode is the point: a node graph on a 412px screen is not a thing anyone
  // wants, so ComfyUI stays hidden there regardless of the stored preference.
  return useMemo(() => (isDesktop ? focusMode : true), [focusMode, isDesktop]);
}
