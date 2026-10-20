/**
 * The Workflow step's panel: the run bar, the workflow as a chip (tap = the picker), the prompt
 * hub writing the shared prompt, then every widget of the open workflow as a chip — the pinned
 * ones first, then all of them grouped by node, each editor the same `ParamField` / `ImageInput`
 * the classic `ParamList` draws, with the pin beside it. No Simple / Advanced: everything is on
 * screen, the search box finds a knob by name.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ActionIcon, Button, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconExternalLink, IconPin, IconPinned, IconRefresh, IconRoute, IconSearch } from '@tabler/icons-react';
import { useCanvasStore } from '@/lib/canvasStore';
import { filterChips, formatParamValue } from '@/lib/chips';
import type { ObjectInfo } from '@/lib/workflowGraph';
import { ParamField } from '@/features/studio/ParamField';
import { ImageInput, isImageParam } from '@/features/studio/ImageInput';
import { paramLabel, type WorkflowParam } from '@/features/studio/params';
import { ResetAllButton, WorkflowPicker } from '@/features/studio/StudioPanels';
import { exposedParams, useStudio } from '@/features/studio/studioStore';
import { useWorkflowLibrary, type WorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { ChipPopover, ChipRow } from './ChipPopover';
import { WorkflowRunBar } from './RunBars';
import { PromptHub } from './PromptHub';

const NO_IDS: string[] = [];
const NO_VALUES: Record<string, unknown> = {};

/** The open workflow as one chip; its editor is the picker, Refresh, Focus mode and the way into ComfyUI. */
function WorkflowChip({ library, large }: { library: WorkflowLibrary; large: boolean }) {
  const path = useStudio(s => s.path);
  const focusMode = useStudio(s => s.focusMode);
  const setFocusMode = useStudio(s => s.setFocusMode);
  const setMainView = useCanvasStore(s => s.setMainView);
  const name = path ? library.workflows.find(w => w.path === path)?.name ?? path.replace(/^.*\//, '').replace(/\.json$/i, '') : null;
  return (
    <ChipRow title="Workflow">
      <ChipPopover label="Workflow" value={name ?? (library.workflows.length ? 'none open' : 'save one in ComfyUI')} changed={!!path} icon={<IconRoute size={14} />} width={400}>
        <div className="flex items-center justify-between gap-2">
          <Text size="xs" c="dimmed">{library.workflows.length} saved in ComfyUI</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconRefresh size={12} />} onClick={library.refresh} loading={library.loading}>Refresh</Button>
        </div>
        <WorkflowPicker workflows={library.workflows} onOpen={p => { void library.open(p); }} onRefresh={library.refresh} large={large} />
        {library.error && <Text size="xs" c="red.4">{library.error}</Text>}
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <Switch size="sm" label="Focus mode" labelPosition="left" checked={focusMode} onChange={e => setFocusMode(e.currentTarget.checked)}
            classNames={{ body: 'justify-between', labelWrapper: 'flex-1' }} description="Hides ComfyUI from the rail so this is the only place to be." />
          {!focusMode && (
            <Button variant="default" size="xs" fullWidth rightSection={<IconExternalLink size={13} />} onClick={() => setMainView('comfy')}>Open ComfyUI</Button>
          )}
        </div>
      </ChipPopover>
    </ChipRow>
  );
}

/** Every widget as a chip: pinned first, then all by node. */
function WorkflowChips({ host, large }: { host: string; large: boolean }) {
  const params = useStudio(s => s.params);
  const path = useStudio(s => s.path);
  const exposedIds = useStudio(s => (s.path ? s.exposed[s.path] ?? NO_IDS : NO_IDS));
  const values = useStudio(s => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setValue = useStudio(s => s.setValue);
  const resetValue = useStudio(s => s.resetValue);
  const toggleExposed = useStudio(s => s.toggleExposed);
  const targetId = useStudio(s => s.targetId());
  const [query, setQuery] = useState('');

  // The prompt box is filled from the hub above, so it is not a chip as well.
  const shownParams = useMemo(() => (targetId ? params.filter(p => p.id !== targetId) : params), [params, targetId]);
  const defs = useMemo(() => shownParams.map(p => ({ id: p.id, label: paramLabel(p), keywords: [p.nodeLabel, p.nodeType, p.name, p.type.toLowerCase()], param: p })), [shownParams]);
  const found = useMemo(() => filterChips(defs, query), [defs, query]);
  const valueOf = (p: WorkflowParam) => (p.id in values ? values[p.id] : p.value);

  if (!path) return null;
  if (!params.length) return <Text size="xs" c="dimmed" ta="center" py="sm">This workflow has no adjustable inputs.</Text>;

  const pinned = exposedParams(found.map(d => d.param), exposedIds);
  const groups: { nodeId: number; label: string; items: WorkflowParam[] }[] = [];
  for (const d of found) {
    const last = groups[groups.length - 1];
    if (last && last.nodeId === d.param.nodeId) last.items.push(d.param);
    else groups.push({ nodeId: d.param.nodeId, label: d.param.nodeLabel, items: [d.param] });
  }

  const chip = (p: WorkflowParam): ReactNode => {
    const value = valueOf(p);
    const on = exposedIds.includes(p.id);
    const editor = isImageParam(p)
      ? <ImageInput param={p} value={value} onChange={v => setValue(p.id, v)} host={host} large={large} />
      : <ParamField param={p} value={value} onChange={v => setValue(p.id, v)} onReset={() => resetValue(p.id)} large={large} />;
    return (
      <ChipPopover key={p.id} label={paramLabel(p)} value={formatParamValue(p, value)} changed={value !== p.value}
        icon={on ? <IconPinned size={13} className="text-accent-fg" /> : undefined} width={isImageParam(p) ? 440 : 360}>
        {editor}
        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
          <Text size="xs" c="dimmed" truncate>{p.nodeLabel} #{p.nodeId}</Text>
          <Tooltip label={on ? 'Unpin' : 'Pin it to the top'} withArrow>
            <ActionIcon size="md" variant={on ? 'light' : 'default'} onClick={() => toggleExposed(p.id)} aria-pressed={on} aria-label={on ? 'Unpin' : 'Pin'}>
              {on ? <IconPinned size={15} /> : <IconPin size={15} />}
            </ActionIcon>
          </Tooltip>
        </div>
      </ChipPopover>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TextInput size={large ? 'md' : 'xs'} value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Find a control…" leftSection={<IconSearch size={14} />} aria-label="Find a control" className="min-w-0 flex-1" />
        <ResetAllButton />
      </div>
      {pinned.length > 0 && <ChipRow title="Pinned">{pinned.map(chip)}</ChipRow>}
      {groups.map(g => <ChipRow key={g.nodeId} title={`${g.label} #${g.nodeId}`}>{g.items.map(chip)}</ChipRow>)}
      {found.length === 0 && <Text size="xs" c="dimmed" ta="center" py="sm">No control called “{query}”.</Text>}
      {!pinned.length && !query && <Text size="xs" c="dimmed">Pin a control (inside its chip) to keep it on top.</Text>}
    </div>
  );
}

/** The scrolling part, shared by both shells. */
export function WorkflowStepBody({ host, library, large = false }: { host: string; library: WorkflowLibrary; large?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <WorkflowChip library={library} large={large} />
      <PromptHub kind="workflow" large={large} />
      <WorkflowChips host={host} large={large} />
    </div>
  );
}

export function WorkflowStep({ host, info }: { host: string; info: ObjectInfo | null }) {
  const library = useWorkflowLibrary(host, info);
  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Workflow step" data-pad-start>
      <div className="shrink-0 border-b border-border-default p-2.5"><WorkflowRunBar host={host} info={info} /></div>
      <div className="scroll-y min-h-0 flex-1 p-2.5" style={{ touchAction: 'pan-y' }}><WorkflowStepBody host={host} library={library} /></div>
    </div>
  );
}

