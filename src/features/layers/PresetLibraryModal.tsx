/**
 * The prompt preset library: whole prompts to start an experiment from. Opened from the book
 * button on the Prompt and Negative Prompt boxes. A preset replaces the box's text; the model
 * family control puts the right quality tags in front, guessed from the base checkpoint.
 * Every replace offers Undo.
 */
import { useMemo, useState } from 'react';
import {
  Badge, Box, Button, Checkbox, Group, Modal, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import {
  FAMILY_LABELS, NEGATIVE_PRESETS, PRESET_CATEGORIES, PROMPT_PRESETS, familyForCheckpoint, presetPrompt,
  type ModelFamily,
} from '@/lib/promptLibrary';
import type { LayerKind } from '@/lib/types';
import { categoryColor } from './SnippetsModal';

const ALL = 'All';

/** Set the big text box of one kind: its first part, made if there is none. */
function setMainText(kind: LayerKind, text: string) {
  const st = useStore.getState();
  const main = st.layers.find((l) => l.kind === kind);
  if (main) st.updateLayer(main.id, { text, on: true });
  else st.addLayer(kind, { text });
}

function mainText(kind: LayerKind): string {
  return useStore.getState().layers.find((l) => l.kind === kind)?.text ?? '';
}

function applyWithUndo(changes: Partial<Record<LayerKind, string>>, name: string) {
  const before = Object.fromEntries(Object.keys(changes).map((k) => [k, mainText(k as LayerKind)])) as Partial<Record<LayerKind, string>>;
  for (const [kind, text] of Object.entries(changes)) setMainText(kind as LayerKind, text!);
  const id = `preset-${Date.now()}`;
  notifications.show({
    id, color: 'teal', autoClose: 6000, title: `Used “${name}”`,
    message: (
      <Button size="compact-xs" variant="light" mt={4} onClick={() => {
        for (const [kind, text] of Object.entries(before)) setMainText(kind as LayerKind, text!);
        notifications.hide(id);
      }}>Undo</Button>
    ),
  });
}

export function PresetLibraryModal({ opened, onClose, kind }: { opened: boolean; onClose: () => void; kind: LayerKind }) {
  const checkpoint = useStore((s) => s.workflow.checkpoints[0]?.name);
  const [family, setFamily] = useState<ModelFamily | null>(null);
  const fam = family ?? familyForCheckpoint(checkpoint);
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [withNegative, setWithNegative] = useState(true);
  const positive = kind === 'positive';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROMPT_PRESETS.filter((p) => (category === ALL || p.category === category)
      && (!q || `${p.name} ${p.category} ${p.positive}`.toLowerCase().includes(q)));
  }, [category, search]);

  const familyControl = (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">Model</Text>
      <SegmentedControl size="xs" value={fam} onChange={(v) => setFamily(v as ModelFamily)}
        data={(Object.keys(FAMILY_LABELS) as ModelFamily[]).map((f) => ({ value: f, label: FAMILY_LABELS[f] }))} />
    </Group>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600} size="lg">{positive ? 'Prompt presets' : 'Negative presets'}</Text>}
      size={positive ? '80vw' : 'lg'}
      centered
      styles={{
        content: positive ? { maxWidth: 1200, height: '80vh', maxHeight: 800, display: 'flex', flexDirection: 'column' } : undefined,
        body: positive ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 } : undefined,
        header: { borderBottom: '1px solid var(--mantine-color-dark-4)' },
      }}
    >
      {positive ? (
        <Group align="stretch" gap={0} style={{ flex: 1, overflow: 'hidden' }} wrap="nowrap">
          <Box visibleFrom="sm" style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--mantine-color-dark-4)' }}>
            <ScrollArea h="100%" p="sm">
              <Stack gap={2}>
                {[ALL, ...PRESET_CATEGORIES].map((c) => {
                  const active = c === category;
                  const count = c === ALL ? PROMPT_PRESETS.length : PROMPT_PRESETS.filter((p) => p.category === c).length;
                  return (
                    <UnstyledButton key={c} onClick={() => setCategory(c)} px="sm" py={8}
                      style={{ borderRadius: 6, display: 'flex', justifyContent: 'space-between', backgroundColor: active ? 'var(--mantine-color-dark-5)' : undefined }}>
                      <Text size="sm" fw={active ? 600 : 400} c={active ? undefined : 'dimmed'}>{c}</Text>
                      <Text size="xs" c="dimmed">{count}</Text>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Box>
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Stack p="md" gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
              <Group gap="sm" wrap="wrap">
                <TextInput placeholder="Search presets..." leftSection={<IconSearch size={16} />} value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)} size="sm" style={{ flex: 1, minWidth: 180 }} data-autofocus />
                {familyControl}
              </Group>
              <Checkbox size="xs" label="Also replace the negative prompt" checked={withNegative} onChange={(e) => setWithNegative(e.currentTarget.checked)} />
            </Stack>
            <ScrollArea style={{ flex: 1 }} p="md">
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {visible.map((p) => {
                  const text = presetPrompt(p, fam);
                  return (
                    <PresetCard key={p.id} name={p.name} badge={p.category} text={p.positive} tip={p.tip}
                      onUse={() => {
                        applyWithUndo(withNegative ? { positive: text.positive, negative: text.negative } : { positive: text.positive }, p.name);
                        onClose();
                      }} />
                  );
                })}
              </SimpleGrid>
              {visible.length === 0 && <Text c="dimmed" ta="center" py="xl">No presets match “{search}”.</Text>}
            </ScrollArea>
          </Box>
        </Group>
      ) : (
        <Stack gap="sm" pt="sm">
          {NEGATIVE_PRESETS.map((p) => (
            <PresetCard key={p.id} name={p.name} text={p.text} tip={p.tip}
              onUse={() => { applyWithUndo({ negative: p.text }, p.name); onClose(); }}
              onAppend={() => {
                const cur = mainText('negative').trim().replace(/,\s*$/, '');
                applyWithUndo({ negative: cur ? `${cur}, ${p.text}` : p.text }, p.name);
                onClose();
              }} />
          ))}
        </Stack>
      )}
    </Modal>
  );
}

function PresetCard({ name, badge, text, tip, onUse, onAppend }: {
  name: string; badge?: string; text: string; tip?: string; onUse: () => void; onAppend?: () => void;
}) {
  return (
    <Paper p="sm" withBorder style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={600} truncate>{name}</Text>
        {badge && <Badge size="xs" variant="light" color={categoryColor(badge)}>{badge}</Badge>}
      </Group>
      <Text size="xs" c="dimmed" lineClamp={4} style={{ flex: 1 }}>{text}</Text>
      {tip && <Text size="xs" c="teal.4" fs="italic">{tip}</Text>}
      <Group gap="xs" justify="flex-end">
        {onAppend && <Button size="compact-sm" variant="subtle" onClick={onAppend}>Add to end</Button>}
        <Button size="compact-sm" variant="light" onClick={onUse}>Use</Button>
      </Group>
    </Paper>
  );
}
