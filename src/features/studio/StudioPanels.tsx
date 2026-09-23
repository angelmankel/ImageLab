/**
 * The pieces both Studio shells are built from: the workflow picker, the knob list, and the image
 * area. Keeping them here means the phone and the desktop show the same thing arranged
 * differently, rather than being two implementations that drift apart.
 */
import { useEffect, useRef, useState } from 'react';
import type { SavedWorkflow } from '@/lib/comfy';
import { useCanvasStore } from '@/lib/canvasStore';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { FullscreenImage } from '@/components/FullscreenImage';
import { cn } from '@/lib/cn';
import {
  ActionIcon, Badge, Button, Checkbox, Group, NavLink, Paper, Progress, Select, Stack, Text, Textarea,
  Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconRefresh, IconStar, IconStarFilled, IconArrowBackUp } from '@tabler/icons-react';
import { ParamField } from './ParamField';
import { ImageInput, isImageParam } from './ImageInput';
import { paramLabel, type WorkflowParam } from './params';
import { composePrompt, exposedParams, promptCandidates, useStudio } from './studioStore';

/**
 * Stable empties.
 *
 * A zustand selector is compared by reference. `s.exposed[path] ?? []` builds a new array on every
 * render, so the store reports a change every time, which re-renders, which builds another — React
 * error #185, "maximum update depth exceeded". Returning the same frozen empty breaks the cycle.
 */
const NO_IDS: string[] = [];
const NO_VALUES: Record<string, unknown> = {};

/** Pick which saved ComfyUI workflow to drive. */
export function WorkflowPicker({
  workflows, onOpen, onRefresh, large,
}: {
  workflows: SavedWorkflow[];
  onOpen: (path: string) => void;
  onRefresh: () => void;
  large?: boolean;
}) {
  const path = useStudio(s => s.path);

  if (!workflows.length) {
    return (
      <Paper withBorder radius="md" p="md" className="flex flex-col items-center gap-2 !border-dashed text-center">
        <Text size="sm" fw={500}>No saved workflows yet</Text>
        <Text size="xs" c="dimmed">
          Build one in ComfyUI and save it. It shows up here on its own, a moment later.
        </Text>
        <Button size="compact-xs" variant="subtle" leftSection={<IconRefresh size={12} />} onClick={onRefresh}>
          Look again
        </Button>
      </Paper>
    );
  }

  return (
    <Stack gap={2}>
      {workflows.map(w => (
        <NavLink
          key={w.path}
          component="button"
          type="button"
          onClick={() => onOpen(w.path)}
          active={w.path === path}
          label={w.name}
          rightSection={w.path === path ? <Badge size="xs" variant="light">open</Badge> : null}
          className={cn('rounded-sm', large ? 'min-h-[48px]' : 'min-h-[40px]')}
          classNames={{ label: cn('truncate', large ? 'text-[14px]' : 'text-[13px]') }}
        />
      ))}
    </Stack>
  );
}

/**
 * The knobs.
 *
 * In simple mode this is only what the person chose to expose — the point of the whole view: a
 * workflow with ninety widgets reduced to the four that matter today. In advanced mode it is
 * everything, grouped by the node it came from, each with a pin that adds it to simple mode.
 */
export function ParamList({ large, host }: { large?: boolean; host: string | null }) {
  const params = useStudio(s => s.params);
  const path = useStudio(s => s.path);
  const mode = useStudio(s => s.mode);
  const exposedIds = useStudio(s => (s.path ? s.exposed[s.path] ?? NO_IDS : NO_IDS));
  const values = useStudio(s => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const setValue = useStudio(s => s.setValue);
  const resetValue = useStudio(s => s.resetValue);
  const toggleExposed = useStudio(s => s.toggleExposed);
  // A string or null, so comparing by reference is safe: this re-renders only when it changes.
  const targetId = useStudio(s => s.targetId());

  if (!path) return <Hint>Pick a workflow to see its controls.</Hint>;
  if (!params.length) return <Hint>This workflow has no adjustable inputs.</Hint>;
  // The prompt box is filled from the prompt panel above, so offering it here as well would be two
  // editors for one field, with this one silently overwritten on every run.
  const shownParams = targetId ? params.filter(p => p.id !== targetId) : params;

  const valueOf = (p: WorkflowParam) => (p.id in values ? values[p.id] : p.value);

  /** An image input gets the uploader; everything else gets the normal control. */
  const render = (p: WorkflowParam) =>
    isImageParam(p) && host ? (
      <ImageInput
        key={p.id}
        param={p}
        value={valueOf(p)}
        onChange={v => setValue(p.id, v)}
        host={host}
        large={large}
      />
    ) : (
      <ParamField
        key={p.id}
        param={p}
        value={valueOf(p)}
        onChange={v => setValue(p.id, v)}
        onReset={() => resetValue(p.id)}
        large={large}
      />
    );

  if (mode === 'simple') {
    const shown = exposedParams(shownParams, exposedIds);
    if (!shown.length) {
      return (
        <Hint>
          Nothing is pinned yet. Switch to Advanced and pin the few controls you want here.
        </Hint>
      );
    }
    return <div className="flex flex-col gap-1">{shown.map(render)}</div>;
  }

  // Advanced: every knob, grouped by node, in graph order.
  const groups: { nodeId: number; label: string; items: WorkflowParam[] }[] = [];
  for (const p of shownParams) {
    const last = groups[groups.length - 1];
    if (last && last.nodeId === p.nodeId) last.items.push(p);
    else groups.push({ nodeId: p.nodeId, label: p.nodeLabel, items: [p] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(g => (
        <section key={g.nodeId} className="flex flex-col gap-1">
          <Group gap={6} wrap="nowrap" component="h3" className="!m-0">
            <Text size="xs" fw={600} c="dimmed" truncate>{g.label}</Text>
            <Text size="xs" c="dark.3" className="shrink-0">#{g.nodeId}</Text>
          </Group>
          {g.items.map(p => (
            <div key={p.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{render(p)}</div>
              <Tooltip label={exposedIds.includes(p.id) ? 'Remove from the simple view' : 'Show this in the simple view'} withArrow>
                <ActionIcon
                  size="lg"
                  variant={exposedIds.includes(p.id) ? 'light' : 'default'}
                  onClick={() => toggleExposed(p.id)}
                  aria-pressed={exposedIds.includes(p.id)}
                  aria-label={exposedIds.includes(p.id) ? 'Remove from the simple view' : 'Show this in the simple view'}
                  mt={24}
                  className="shrink-0"
                >
                  {exposedIds.includes(p.id) ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                </ActionIcon>
              </Tooltip>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * The prompt, split in two.
 *
 * Keywords belong to the workflow: the score tags Pony wants, the quality prefix an Illustrious
 * merge wants, a LoRA's trigger word. The prompt is the subject, and by default it is shared, so
 * switching from one workflow to another keeps what was being drawn and swaps only the model's own
 * vocabulary. A workflow can opt out and keep a prompt of its own.
 *
 * Both are joined, keywords first, into the workflow's positive text box on every run.
 */
export function PromptPanel({ large }: { large?: boolean }) {
  const path = useStudio(s => s.path);
  const params = useStudio(s => s.params);
  const targetId = useStudio(s => s.targetId());
  const keywords = useStudio(s => (s.path ? s.keywords[s.path] ?? '' : ''));
  const shared = useStudio(s => (s.path ? s.useShared[s.path] !== false : true));
  const prompt = useStudio(s => (s.path && s.useShared[s.path] === false ? s.ownPrompt[s.path] ?? '' : s.sharedPrompt));
  const setKeywords = useStudio(s => s.setKeywords);
  const setPrompt = useStudio(s => s.setPrompt);
  const setUseShared = useStudio(s => s.setUseShared);
  const setPromptTarget = useStudio(s => s.setPromptTarget);

  if (!path || !targetId) return null;
  const candidates = promptCandidates(params);
  const size = large ? 'md' : 'sm';
  const sent = composePrompt(keywords, prompt);

  return (
    <Stack gap="xs" component="section" className="border-b border-border-subtle pb-4">
      <Textarea
        label="Keywords · this workflow"
        value={keywords}
        onChange={e => setKeywords(e.currentTarget.value)}
        rows={2}
        size={size}
        autosize={false}
        aria-label="Keywords for this workflow"
        placeholder="Tags only this model needs, e.g. score_9, score_8_up"
        classNames={{ input: 'scroll-y !resize-y' }}
      />

      <Stack gap={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="sm" fw={500}>Prompt</Text>
          <Checkbox
            size="xs"
            label="Shared with other workflows"
            checked={shared}
            onChange={e => setUseShared(e.currentTarget.checked)}
          />
        </Group>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.currentTarget.value)}
          rows={large ? 6 : 5}
          size={size}
          aria-label="Prompt"
          placeholder="What to draw"
          classNames={{ input: 'scroll-y !resize-y' }}
        />
      </Stack>

      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" className="shrink-0">Sent to</Text>
        {candidates.length > 1 ? (
          <Select
            size="xs"
            value={targetId}
            onChange={v => { if (v) setPromptTarget(v); }}
            allowDeselect={false}
            aria-label="Which text box receives the prompt"
            data={candidates.map(c => ({ value: c.id, label: `${c.nodeLabel} #${c.nodeId}` }))}
            comboboxProps={{ withinPortal: true, shadow: 'md' }}
            className="min-w-0 flex-1"
          />
        ) : (
          <Text size="xs" truncate className="min-w-0 flex-1">
            {candidates[0]?.nodeLabel} #{candidates[0]?.nodeId}
          </Text>
        )}
        <Text size="xs" c="dimmed" className="shrink-0 tabular-nums" title={sent}>{sent.length} chars</Text>
      </Group>
    </Stack>
  );
}

/**
 * What the run is doing, and what it made.
 *
 * While a job is live this shows ComfyUI's own preview frames — the partially-denoised image it
 * pushes down the socket each step — with a real progress bar under it and the name of the node
 * currently executing. Before the socket carried these, the only honest thing to show was the
 * word "Running".
 */
export function ResultView({
  results, latest, busy, status, progress, currentNode, preview, queueRemaining,
}: {
  results: { url: string; filename: string }[];
  latest: { url: string } | null;
  busy: boolean;
  status: string | null;
  progress?: number | null;
  currentNode?: string | null;
  preview?: string | null;
  queueRemaining?: number;
}) {
  // The image picked from the strip, by URL so it stays put while new results push the list along.
  // Null means "follow the newest", which is what a finished run should show.
  const [picked, setPicked] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // A new image landing means a run finished: show it, rather than holding an old pick.
  const newest = latest?.url ?? null;
  useEffect(() => { setPicked(null); }, [newest]);

  const index = picked ? Math.max(0, results.findIndex(r => r.url === picked)) : 0;
  const current = results[index] ?? null;
  // A live preview outranks everything: it is what is happening now.
  const livePreview = busy && preview ? preview : null;
  const shown = livePreview ?? current?.url ?? null;

  // ← older, → newer: the same direction as the generate view's history.
  const step = (dir: 1 | -1) => {
    if (!results.length) return;
    const next = Math.min(results.length - 1, Math.max(0, index + dir));
    setPicked(results[next].url);
  };
  const inStudio = () => useCanvasStore.getState().mainView === 'studio' && fullscreen === null;
  useShortcut('ArrowLeft', () => step(1), { priority: ShortcutPriority.Panel + 10, when: inStudio });
  useShortcut('ArrowRight', () => step(-1), { priority: ShortcutPriority.Panel + 10, when: inStudio });

  // Keep the picked thumbnail in view as the arrows walk the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [index]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Paper withBorder radius="md" className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" bg="dark.8">
        {shown ? (
          <img
            src={shown}
            alt={livePreview ? 'Live preview' : current?.filename ?? 'Generation'}
            onClick={() => { if (!livePreview && current) setFullscreen(index); }}
            // h-full w-full + object-contain scales a small preview frame up to the whole area,
            // where max-* alone left a 512px preview sitting in the middle of a large pane.
            className={cn('h-full w-full object-contain', !livePreview && 'cursor-zoom-in')}
          />
        ) : (
          <Text size="sm" c="dimmed" fs="italic" ta="center" px="lg">
            {busy ? (status ?? 'Working…') : 'No image yet — press Generate.'}
          </Text>
        )}

        {!busy && results.length > 1 && (
          <Badge variant="filled" color="dark" radius="sm" className="pointer-events-none !absolute right-2 top-2 tabular-nums" style={{ opacity: 0.85 }}>
            {index + 1} / {results.length}
          </Badge>
        )}

        {busy && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
            <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-white/85">
              <span className="truncate">{currentNode ?? status ?? 'Working…'}</span>
              <span className="shrink-0 tabular-nums">
                {progress != null ? `${Math.round(progress * 100)}%` : ''}
                {queueRemaining ? ` · ${queueRemaining} queued` : ''}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              {progress != null ? (
                // A real bar once a sampler reports steps.
                <Progress value={Math.max(2, progress * 100)} size={4} radius="xl" bg="transparent" transitionDuration={150} />
              ) : (
                // Between nodes there are no steps to count, so sweep rather than sit at zero.
                <div className="animate-view-loading h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />
              )}
            </div>
          </div>
        )}
      </Paper>

      {results.length > 0 && (
        <div ref={stripRef} className="scroll-x-thin flex shrink-0 gap-2 pb-1">
          {results.map((r, i) => (
            // v1 thumbnail strip: a 2px primary border on the current one, the rest dimmed.
            <UnstyledButton
              key={r.url}
              data-index={i}
              onClick={() => setPicked(r.url)}
              onDoubleClick={() => setFullscreen(i)}
              aria-label={`Show ${r.filename}`}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-sm border-2 transition-all duration-150',
                i === index && !livePreview
                  ? 'border-[var(--mantine-primary-color-filled)]'
                  : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={r.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </UnstyledButton>
          ))}
        </div>
      )}

      {fullscreen !== null && (
        <FullscreenImage
          items={results.map(r => ({ key: r.url, url: r.url }))}
          index={fullscreen}
          onIndexChange={i => { setFullscreen(i); setPicked(results[i]?.url ?? null); }}
          onClose={() => setFullscreen(null)}
          pageCaption={results[fullscreen]?.filename}
        />
      )}
    </div>
  );
}

/** Reset every knob on the open workflow back to what ComfyUI saved. */
export function ResetAllButton() {
  const path = useStudio(s => s.path);
  const params = useStudio(s => s.params);
  const resetValue = useStudio(s => s.resetValue);
  if (!path || !params.length) return null;
  return (
    <Tooltip label="Back to the values saved in ComfyUI" withArrow>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Reset every control"
        onClick={() => params.forEach(p => resetValue(p.id))}
      >
        <IconArrowBackUp size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text size="sm" c="dimmed" ta="center" px={4} py="lg">{children}</Text>;
}

export { paramLabel };
