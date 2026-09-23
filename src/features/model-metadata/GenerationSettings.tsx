import { useState } from 'react';
import type { CivitaiImage } from './civitai';
import { useStore } from '@/lib/store';
import { CIVITAI_CATEGORY_ID } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { ActionIcon, Button, Group, Paper, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronRight, IconCopy, IconDeviceFloppy } from '@tabler/icons-react';

/**
 * The selected gallery image's generation parameters — Civitai's `image.meta`
 * (prompt, sampler, steps, CFG, seed). The prompt takes the slack at the top
 * and scrolls; below it the params are a vertical, single-column list of
 * clickable rows that apply each value to the active workflow on tap.
 *
 * The prompt has its own "save to library" action that creates a snippet
 * under the Civit.ai category (the category is created on demand).
 */
export function GenerationSettings({
  image,
  onCollapse,
}: {
  image: CivitaiImage | null;
  onCollapse?: () => void;
}) {
  const meta = image?.meta ?? null;
  const setWorkflow = useStore((s) => s.setWorkflow);
  const setStatus = useStore((s) => s.setStatus);
  const addSnippet = useStore((s) => s.addSnippet);
  const snippetCategories = useStore((s) => s.snippetCategories);
  const addSnippetCategory = useStore((s) => s.addSnippetCategory);

  const copyAll = () => {
    if (!meta) return;
    navigator.clipboard?.writeText(JSON.stringify(meta, null, 2)).catch(() => { /* clipboard unavailable */ });
  };

  const applyPatch = (patch: Parameters<typeof setWorkflow>[0], label: string) => {
    setWorkflow(patch);
    setStatus(`Applied ${label}`, 'ok');
  };

  const ensureCivitaiCategory = (): string => {
    if (snippetCategories.some((c) => c.id === CIVITAI_CATEGORY_ID)) return CIVITAI_CATEGORY_ID;
    return addSnippetCategory('Civit.ai', '🅒');
  };

  const saveAsSnippet = () => {
    const prompt = meta?.prompt?.trim();
    if (!prompt) return;
    const categoryId = ensureCivitaiCategory();
    // Derive a short, readable name from the first few words.
    const name = prompt.split(/[,\n]/)[0]?.trim().slice(0, 60) || 'Civit.ai prompt';
    addSnippet({
      name,
      tag: 'Civit.ai',
      text: prompt,
      weight: 1,
      kind: 'positive',
      categoryId,
    });
    setStatus(`Saved snippet to Civit.ai library`, 'ok');
  };

  return (
    <Stack gap="sm" h="100%">
      <Group gap="xs" wrap="nowrap" className="shrink-0">
        <Text size="xs" fw={600} c="dimmed">Generation settings</Text>
        <div className="flex-1" />
        {meta && (
          <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconCopy size={12} />} onClick={copyAll}>
            Copy
          </Button>
        )}
        {onCollapse && (
          <Tooltip label="Hide generation settings" withArrow>
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={onCollapse} aria-label="Hide generation settings">
              <IconChevronRight size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {meta ? (
        <>
          {/* Prompt — takes the slack, with a "save as snippet" action. */}
          <Stack gap={6} className="min-h-0 flex-1">
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" fw={600} c="dimmed">Prompt</Text>
              {meta.prompt && (
                <Tooltip label="Save prompt to library under Civit.ai" withArrow>
                  <ActionIcon size="xs" variant="subtle" color="green" onClick={saveAsSnippet} aria-label="Save snippet">
                    <IconDeviceFloppy size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <Paper withBorder radius="sm" className="min-h-[120px] flex-1 overflow-hidden" bg="dark.7">
              {meta.prompt ? (
                <ScrollArea scrollbars="y" h="100%" type="auto">
                  <Text size="xs" p="xs" className="whitespace-pre-wrap leading-relaxed">{meta.prompt}</Text>
                </ScrollArea>
              ) : (
                <Text size="xs" c="dimmed" ta="center" className="flex h-full items-center justify-center">
                  No prompt recorded
                </Text>
              )}
            </Paper>
          </Stack>

          {/* Vertical, single-column param list. Each row is clickable and
              applies its value to the workflow. */}
          <Stack gap={4} className="shrink-0">
            <ParamRow
              label="Sampler"
              value={meta.sampler ?? '—'}
              hint="Click to apply"
              onClick={meta.sampler ? () => applyPatch({ sampler: String(meta.sampler) }, `sampler ${meta.sampler}`) : undefined}
            />
            <ParamRow
              label="Steps"
              value={meta.steps != null ? String(meta.steps) : '—'}
              hint="Click to apply"
              onClick={meta.steps != null ? () => applyPatch({ steps: Number(meta.steps) }, `steps ${meta.steps}`) : undefined}
            />
            <ParamRow
              label="CFG scale"
              value={meta.cfgScale != null ? String(meta.cfgScale) : '—'}
              hint="Click to apply"
              onClick={meta.cfgScale != null ? () => applyPatch({ cfg: Number(meta.cfgScale) }, `CFG ${meta.cfgScale}`) : undefined}
            />
            <ParamRow
              label="Seed"
              value={meta.seed != null ? String(meta.seed) : '—'}
              hint="Click to apply"
              mono
              onClick={meta.seed != null ? () => applyPatch({ seed: Number(meta.seed), randomizeSeed: false }, `seed ${meta.seed}`) : undefined}
            />
          </Stack>
        </>
      ) : (
        <Paper withBorder radius="sm" className="flex min-h-0 flex-1 items-center justify-center" bg="dark.7">
          <Text size="xs" c="dimmed">No generation data for this image.</Text>
        </Paper>
      )}
    </Stack>
  );
}

function ParamRow({
  label, value, mono, hint, onClick,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const [pulse, setPulse] = useState(false);
  const handleClick = () => {
    if (!onClick) return;
    onClick();
    setPulse(true);
    window.setTimeout(() => setPulse(false), 600);
  };
  const disabled = !onClick;
  return (
    <UnstyledButton
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? undefined : hint}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-sm border px-2.5 py-1.5 text-left transition-colors',
        'border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-7)]',
        disabled ? 'cursor-default' : 'hover:border-[var(--mantine-primary-color-filled)]',
        pulse && '!border-[var(--mantine-primary-color-filled)] !bg-[var(--mantine-primary-color-light)]',
      )}
    >
      <Text size="xs" c="dimmed">{label}</Text>
      <Group gap={6} wrap="nowrap" className="min-w-0">
        {pulse && <IconCheck size={12} color="var(--mantine-primary-color-filled)" />}
        <Text size="sm" fw={600} truncate ff={mono ? 'monospace' : undefined} c={pulse ? 'var(--mantine-primary-color-filled)' : undefined}>
          {value}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
