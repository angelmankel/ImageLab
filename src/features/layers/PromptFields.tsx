/**
 * The Prompts section in v1's shape: a "Prompt" text box with a teal edge, the Snippets row under
 * it, and a "Negative Prompt" box with a red edge — each box with v1's Studio / Save / Clear icons.
 *
 * This app builds a prompt from parts, each with a weight and an on/off switch. The mapping keeps
 * that: the first part of a kind is the big text box, and every further part is a snippet row —
 * a switch, its name, a weight slider, the pencil to edit it, × to remove.
 * So everything v1 did works the same way, and every part the new app can hold is still reachable.
 */
import { StepperInput } from '@/components/fields/StepperInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon, Button, Collapse, Group, Slider, Stack, Switch, Text, Textarea, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBooks, IconChevronDown, IconChevronUp, IconDeviceFloppy, IconEye, IconEyeOff, IconPencil, IconPlus, IconTrash, IconX,
} from '@tabler/icons-react';
import * as Popover from '@/components/ui/popover';
import { FieldWrapper } from '@/components/fields/FieldWrapper';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { DEFAULT_CATEGORY_ID } from '@/lib/storage';
import type { Layer, LayerKind } from '@/lib/types';
import { PromptGeneratorButton } from './PromptGeneratorButton';
import { SnippetsModal, categoryColor } from './SnippetsModal';
import { PresetLibraryModal } from './PresetLibraryModal';

/** Weights run 0–2 here (v1 stopped at 1); the bar shows the whole range. */
const MAX_WEIGHT = 2;
const COMMIT_MS = 250;

export function PromptFields() {
  return (
    <Stack gap="md">
      <PromptBox kind="positive" />
      <SnippetsRow kind="positive" />
      <PromptBox kind="negative" />
      <SnippetsRow kind="negative" compact />
    </Stack>
  );
}

function useKindLayers(kind: LayerKind) {
  const layers = useStore((s) => s.layers);
  return useMemo(() => layers.filter((l) => l.kind === kind), [layers, kind]);
}

// ============================================
// The main text box
// ============================================

function PromptBox({ kind }: { kind: LayerKind }) {
  const parts = useKindLayers(kind);
  const main = parts[0] as Layer | undefined;
  const positive = kind === 'positive';
  const accent = positive ? 'teal' : 'red';
  const [presetsOpen, setPresetsOpen] = useState(false);

  // A local draft so typing never waits on the store; committed on a short timer and on blur.
  const [draft, setDraft] = useState(main?.text ?? '');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainId = useRef<string | undefined>(main?.id);
  mainId.current = main?.id;

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const text = pending.current;
    if (text === null) return;
    pending.current = null;
    const st = useStore.getState();
    if (mainId.current) st.updateLayer(mainId.current, { text });
    else if (text.trim()) mainId.current = st.addLayer(kind, { text });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flush(), []);
  useEffect(() => { if (pending.current === null) setDraft(main?.text ?? ''); }, [main?.text, main?.id]);

  const onChange = (text: string) => {
    setDraft(text);
    pending.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMIT_MS);
  };

  const saveToLibrary = () => {
    flush();
    const text = draft.trim();
    if (!text) return;
    const st = useStore.getState();
    if (st.snippets.some((s) => s.text.trim() === text && s.kind === kind)) {
      notifications.show({ title: 'Already saved', message: 'This prompt is already in your library', color: 'yellow' });
      return;
    }
    const words = text.split(/\s+/);
    st.addSnippet({
      name: words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : ''),
      text, kind, tag: main?.tag ?? '', weight: main?.weight ?? 1, categoryId: DEFAULT_CATEGORY_ID,
    });
    notifications.show({ title: 'Prompt saved', message: 'Prompt added to your library', color: 'green' });
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    setDraft('');
    if (main) useStore.getState().updateLayer(main.id, { text: '' });
  };

  return (
    <FieldWrapper
      label={positive ? 'Prompt' : 'Negative Prompt'}
      rightSection={
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={positive ? 'Use a preset prompt' : 'Use a preset negative'}>
            <ActionIcon size="sm" variant="subtle" onClick={() => { flush(); setPresetsOpen(true); }} aria-label={positive ? 'Prompt presets' : 'Negative presets'}>
              <IconBooks size="1rem" />
            </ActionIcon>
          </Tooltip>
          {positive && <PromptGeneratorButton variant="icon" />}
          <Tooltip label="Save to library">
            <ActionIcon size="sm" variant="subtle" onClick={saveToLibrary} disabled={!draft.trim()} aria-label="Save prompt to library">
              <IconDeviceFloppy size="1rem" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Clear">
            <ActionIcon size="sm" variant="subtle" onClick={clear} disabled={!draft.trim()} aria-label={positive ? 'Clear prompt' : 'Clear negative prompt'}>
              <IconX size="1rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
    >
      <Textarea
        placeholder={positive ? 'Describe what you want to generate...' : 'What to avoid...'}
        value={draft}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={flush}
        autosize
        minRows={positive ? 4 : 2}
        maxRows={positive ? 14 : 8}
        aria-label={positive ? 'Prompt' : 'Negative prompt'}
        classNames={{ input: `prompt-accent-${accent}` }}
        styles={{
          input: {
            borderLeft: `3px solid var(--mantine-color-${accent}-6)`,
            paddingLeft: 'calc(var(--mantine-spacing-sm) + 2px)',
            opacity: main && !main.on ? 0.5 : 1,
          },
        }}
      />
      <PresetLibraryModal opened={presetsOpen} onClose={() => setPresetsOpen(false)} kind={kind} />
    </FieldWrapper>
  );
}

// ============================================
// Snippets row (every part after the first)
// ============================================

function SnippetsRow({ kind, compact }: { kind: LayerKind; compact?: boolean }) {
  const parts = useKindLayers(kind);
  const extras = parts.slice(1);
  const layers = useStore((s) => s.layers);
  const [showPills, setShowPills] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const preview = useMemo(() => compileLayers(layers, kind), [layers, kind]);

  // The negative side only shows its row once there is something in it — v1 had no negative snippets.
  if (compact && extras.length === 0) {
    return (
      <Group justify="flex-end" mt={-8}>
        <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconPlus size="0.75rem" />} onClick={() => setBrowsing(true)}>
          Negative snippets
        </Button>
        <SnippetsModal opened={browsing} onClose={() => setBrowsing(false)} kind={kind} />
      </Group>
    );
  }

  const clearAll = () => {
    const st = useStore.getState();
    const ids = new Set(extras.map((l) => l.id));
    st.setPromptLayers(st.layers.filter((l) => !ids.has(l.id)));
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500}>{kind === 'positive' ? 'Snippets' : 'Negative snippets'}</Text>
          <ActionIcon size="xs" variant="subtle" onClick={() => setShowPills(!showPills)} style={{ opacity: showPills ? 0.4 : 1 }} aria-label={showPills ? 'Hide snippets' : 'Show snippets'}>
            {showPills ? <IconChevronUp size="0.875rem" stroke={2.5} /> : <IconChevronDown size="0.875rem" stroke={2.5} />}
          </ActionIcon>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={showPreview ? 'Hide preview' : 'Show the full compiled prompt'}>
            <ActionIcon size="sm" variant="subtle" onClick={() => setShowPreview(!showPreview)} aria-label={showPreview ? 'Hide preview' : 'Show preview'}>
              {showPreview ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="light" leftSection={<IconPlus size="0.875rem" />} onClick={() => setBrowsing(true)}>Add</Button>
          <Button size="xs" variant="light" color="red" leftSection={<IconTrash size="0.875rem" />} onClick={clearAll} disabled={extras.length === 0}>Clear</Button>
        </Group>
      </Group>

      <Collapse in={showPills}>
        {extras.length === 0 ? (
          <Text size="xs" c="dimmed">No snippets selected. Click &quot;Add&quot; to browse available options.</Text>
        ) : (
          <Stack gap={4}>
            {extras.map((l) => <SnippetRow key={l.id} layer={l} />)}
          </Stack>
        )}
      </Collapse>

      {showPreview && preview && (
        <Textarea
          value={preview}
          readOnly
          autosize
          minRows={3}
          maxRows={6}
          size="xs"
          aria-label="Compiled prompt"
          styles={{ input: { backgroundColor: 'var(--mantine-color-dark-6)', cursor: 'default' } }}
        />
      )}
      <SnippetsModal opened={browsing} onClose={() => setBrowsing(false)} kind={kind} />
    </Stack>
  );
}

/**
 * One snippet as a full-width card: switch, name, edit and remove on top, the weight slider under
 * them. Every part has a fixed size, so dragging the weight never resizes the row or moves the rows around it.
 */
function SnippetRow({ layer }: { layer: Layer }) {
  const snippets = useStore((s) => s.snippets);
  const origin = layer.originSnippetId ? snippets.find((s) => s.id === layer.originSnippetId) : undefined;
  const color = layer.kind === 'negative' ? 'red' : categoryColor(origin?.categoryId ?? 'custom');
  const name = origin?.name || layer.tag.trim() || layer.text.trim().slice(0, 40) || 'Empty';
  const update = (patch: Partial<Layer>) => useStore.getState().updateLayer(layer.id, patch);

  return (
    <Stack
      gap={2} px="xs" py={6}
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        borderLeft: `3px solid var(--mantine-color-${color}-${layer.on ? 6 : 9})`,
        backgroundColor: 'var(--mantine-color-dark-6)',
        opacity: layer.on ? 1 : 0.55,
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <Switch size="sm" color={color} checked={layer.on} onChange={(e) => update({ on: e.currentTarget.checked })} aria-label={`${name} on`} />
        <Tooltip label={layer.text} multiline maw={320} openDelay={500} disabled={!layer.text.trim()}>
          <Text size="sm" truncate style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => update({ on: !layer.on })}>{name}</Text>
        </Tooltip>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <SnippetEditor layer={layer} />
          <ActionIcon size="md" color="gray" variant="subtle" onClick={() => useStore.getState().removeLayer(layer.id)} aria-label={`Remove ${name}`}>
            <IconX size="1rem" />
          </ActionIcon>
        </Group>
      </Group>
      <Group gap="sm" wrap="nowrap" pl={4}>
        <Slider
          size="md" thumbSize={18} color={color} min={0} max={MAX_WEIGHT} step={0.05} label={null} className="touch-pan-y"
          value={layer.weight} onChange={(weight) => update({ weight })} aria-label={`${name} weight`}
          style={{ flex: 1 }}
        />
        <Text size="xs" ff="monospace" w={32} ta="right" style={{ flexShrink: 0 }} c={Math.abs(layer.weight - 1) > 0.001 ? undefined : 'dimmed'}>
          {layer.weight.toFixed(2)}
        </Text>
      </Group>
    </Stack>
  );
}

/** Edit one part in place: its text, label, weight and on/off. */
function SnippetEditor({ layer }: { layer: Layer }) {
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<Layer>) => useStore.getState().updateLayer(layer.id, patch);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <ActionIcon size="md" color="gray" variant="subtle" aria-label="Edit snippet">
          <IconPencil size="1rem" />
        </ActionIcon>
      </Popover.Trigger>
      <Popover.Content side="bottom" align="start" className="w-[300px] rounded-md border border-border-default bg-bg-elev p-3 shadow-xl">
        <Stack gap="xs">
          <Textarea label="Text" value={layer.text} onChange={(e) => update({ text: e.currentTarget.value })} autosize minRows={2} maxRows={8} size="xs" data-autofocus />
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <StepperInput label="Weight" value={layer.weight} min={0} max={MAX_WEIGHT} step={0.05} size="xs" style={{ flex: 1 }}
              onChange={(weight) => update({ weight })} styles={{ input: { textAlign: 'center' } }} />
            <Switch label="On" size="xs" checked={layer.on} onChange={(e) => update({ on: e.currentTarget.checked })} mb={6} />
          </Group>
        </Stack>
      </Popover.Content>
    </Popover.Root>
  );
}
