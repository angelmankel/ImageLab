/**
 * Prompts from CivitAI for the models on this server. Opened from the picture-search button on
 * the Prompt box. The left rail lists every installed checkpoint and LoRA that CivitAI knows
 * (hash → version); the grid shows that version's gallery with each picture's prompt, straight
 * from the Images API (the only endpoint that keeps `meta`). "Use prompt" replaces the Prompt and
 * Negative boxes with Undo; "+ settings" also copies steps, CFG and seed.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  ActionIcon, Badge, Box, Button, Group, Loader, Modal, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput,
  Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconArrowLeft, IconExternalLink, IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { civitaiThumbUrl, type CivitaiImage, type NsfwFilter } from '@/lib/civitai';
import { applyWithUndo } from './PresetLibraryModal';
import { loadNsfw, saveNsfw, useCivitaiGallery, useInstalledCivitai } from './civitaiPrompts';

export function CivitaiPromptsModal({ opened, onClose, only, onUse }: {
  opened: boolean; onClose: () => void;
  /** `video`: only Wan / MiniMax H3 files (the Video panel); `image`: everything else. Default: all. */
  only?: 'video' | 'image';
  /** Where a prompt goes. Default: the image Prompt / Negative boxes with Undo (+ settings). */
  onUse?: (p: { positive: string; negative?: string }) => void;
}) {
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const installed = useInstalledCivitai(only);
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [nsfw, setNsfw] = useState<NsfwFilter>(loadNsfw);
  const [open, setOpen] = useState<CivitaiImage | null>(null);

  const model = installed.find((m) => m.versionId === picked) ?? installed[0] ?? null;
  useEffect(() => { if (opened && picked == null && installed[0]) setPicked(installed[0].versionId); }, [opened, installed, picked]);
  useEffect(() => { saveNsfw(nsfw); }, [nsfw]);
  const { items, loading, failed, hasMore, more } = useCivitaiGallery(model?.versionId ?? null, nsfw, opened);
  useEffect(() => { setOpen(null); }, [model?.versionId, nsfw]);

  const visibleModels = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? installed.filter((m) => `${m.model} ${m.version} ${m.file}`.toLowerCase().includes(q)) : installed;
  }, [installed, filter]);

  const use = (img: CivitaiImage, withSettings: boolean) => {
    const m = img.meta!;
    if (onUse) { onUse({ positive: m.prompt!, negative: m.negativePrompt || undefined }); onClose(); return; }
    applyWithUndo(m.negativePrompt ? { positive: m.prompt!, negative: m.negativePrompt } : { positive: m.prompt! }, `a CivitAI prompt for ${model?.model ?? 'this model'}`);
    if (withSettings) {
      const patch: Record<string, number> = {};
      if (typeof m.steps === 'number') patch.steps = m.steps;
      if (typeof m.cfgScale === 'number') patch.cfg = m.cfgScale;
      if (typeof m.seed === 'number') { patch.seed = m.seed; }
      useStore.getState().setWorkflow(typeof m.seed === 'number' ? { ...patch, randomizeSeed: false } : patch);
    }
    onClose();
  };

  const rail = (
    <Stack gap={6} p="sm" h="100%" style={{ minHeight: 0 }}>
      <TextInput size="xs" placeholder="Filter models" leftSection={<IconSearch size={14} />} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap={2}>
          {visibleModels.map((m) => {
            const active = m.versionId === model?.versionId;
            return (
              <UnstyledButton key={m.versionId} onClick={() => setPicked(m.versionId)} px="xs" py={6}
                style={{ borderRadius: 6, backgroundColor: active ? 'var(--mantine-color-dark-5)' : undefined }}>
                <Group gap="xs" wrap="nowrap">
                  <Box w={36} h={36} style={{ flex: 'none', borderRadius: 4, overflow: 'hidden', background: 'var(--mantine-color-dark-6)' }}>
                    {m.preview && <img src={civitaiThumbUrl(m.preview, 72)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                  </Box>
                  <Box style={{ minWidth: 0 }}>
                    <Text size="sm" fw={active ? 600 : 400} truncate>{m.model}</Text>
                    <Text size="xs" c="dimmed" truncate>{m.type === 'Checkpoint' ? '' : `${m.type} · `}{m.version}</Text>
                  </Box>
                </Group>
              </UnstyledButton>
            );
          })}
          {installed.length === 0 && <Text size="xs" c="dimmed" p="xs">{only === 'video' ? 'No installed video model or LoRA is known to CivitAI yet.' : 'No installed model is known to CivitAI yet. Hashes may still be loading.'}</Text>}
        </Stack>
      </ScrollArea>
    </Stack>
  );

  const detail = open && (
    <Stack p="md" gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Button size="xs" variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => setOpen(null)}>Back to the grid</Button>
        <Group gap="xs">
          {!onUse && <Button size="xs" variant="light" onClick={() => use(open, true)}>Use prompt + settings</Button>}
          <Button size="xs" onClick={() => use(open, false)}>Use prompt</Button>
        </Group>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        <Group align="flex-start" wrap={narrow ? 'wrap' : 'nowrap'} gap="md">
          <img src={civitaiThumbUrl(open.url, 700)} alt="" style={{ width: narrow ? '100%' : 360, borderRadius: 8, flex: 'none' }} />
          <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
            <Box><Text size="xs" c="dimmed" mb={2}>Prompt</Text><Paper withBorder p="sm" radius="md"><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{open.meta?.prompt}</Text></Paper></Box>
            {open.meta?.negativePrompt && <Box><Text size="xs" c="dimmed" mb={2}>Negative</Text><Paper withBorder p="sm" radius="md"><Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{open.meta.negativePrompt}</Text></Paper></Box>}
            <Group gap="xs">
              {open.meta?.steps != null && <Badge variant="light" color="gray">steps {String(open.meta.steps)}</Badge>}
              {open.meta?.cfgScale != null && <Badge variant="light" color="gray">cfg {String(open.meta.cfgScale)}</Badge>}
              {open.meta?.sampler != null && <Badge variant="light" color="gray">{String(open.meta.sampler)}</Badge>}
              {open.meta?.seed != null && <Badge variant="light" color="gray">seed {String(open.meta.seed)}</Badge>}
              {open.meta?.Size != null && <Badge variant="light" color="gray">{String(open.meta.Size)}</Badge>}
            </Group>
          </Stack>
        </Group>
      </ScrollArea>
    </Stack>
  );

  const grid = !open && (
    <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }} wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {model && <Text size="sm" fw={600} truncate>{model.model} <Text span c="dimmed" fw={400}>· {model.version}</Text></Text>}
          {model && <Tooltip label="Open on CivitAI"><ActionIcon size="sm" variant="subtle" component="a" href={`https://civitai.com/models/${model.modelId}?modelVersionId=${model.versionId}`} target="_blank" rel="noreferrer"><IconExternalLink size={14} /></ActionIcon></Tooltip>}
        </Group>
        <SegmentedControl size="xs" value={nsfw} onChange={(v) => setNsfw(v as NsfwFilter)} data={[{ value: 'all', label: 'All' }, { value: 'sfw', label: 'SFW' }, { value: 'nsfw', label: 'NSFW' }]} />
      </Group>
      <ScrollArea style={{ flex: 1 }} p="sm">
        {failed && <Text c="red" size="sm" ta="center" py="xl">CivitAI did not answer. Try again in a moment.</Text>}
        {!failed && !loading && items.length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">No pictures with a prompt for this version{nsfw !== 'all' ? ' under this filter' : ''}.</Text>}
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 4, xl: 5 }} spacing="sm">
          {items.map((img, i) => (
            <Paper key={`${img.url}-${i}`} withBorder radius="md" p={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <UnstyledButton onClick={() => setOpen(img)} style={{ display: 'block' }}>
                <Box style={{ aspectRatio: `${img.width} / ${img.height}`, maxHeight: 260, overflow: 'hidden', background: '#000' }}>
                  <img src={civitaiThumbUrl(img.url, 450)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
              </UnstyledButton>
              <Stack gap={6} p="xs" style={{ flex: 1 }}>
                <Text size="xs" lineClamp={3} style={{ flex: 1 }} title={img.meta?.prompt}>{img.meta?.prompt}</Text>
                <Group gap={4} justify="space-between" wrap="nowrap">
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setOpen(img)}>Details</Button>
                  <Button size="compact-xs" variant="light" onClick={() => use(img, false)}>Use prompt</Button>
                </Group>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
        <Group justify="center" py="md">
          {loading ? <Loader size="sm" /> : hasMore && model ? <Button variant="default" size="xs" onClick={more}>Load more</Button> : null}
        </Group>
      </ScrollArea>
    </Stack>
  );

  return (
    <Modal
      opened={opened} onClose={onClose} centered fullScreen={narrow} size="80vw"
      title={<Text fw={600} size="lg">Prompts from CivitAI for your models</Text>}
      styles={{
        content: narrow ? { display: 'flex', flexDirection: 'column' } : { maxWidth: 1300, height: '85vh', maxHeight: 900, display: 'flex', flexDirection: 'column' },
        body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 },
        header: { borderBottom: '1px solid var(--mantine-color-dark-4)' },
      }}
    >
      <Group align="stretch" gap={0} style={{ flex: 1, overflow: 'hidden' }} wrap="nowrap">
        {!narrow && <Box style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--mantine-color-dark-4)' }}>{rail}</Box>}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {narrow && !open && (
            <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
              <ScrollArea type="never"><Group gap={4} wrap="nowrap">
                {installed.map((m) => <Button key={m.versionId} size="compact-xs" variant={m.versionId === model?.versionId ? 'filled' : 'default'} onClick={() => setPicked(m.versionId)}>{m.model}</Button>)}
              </Group></ScrollArea>
            </Box>
          )}
          {detail || grid}
        </Box>
      </Group>
    </Modal>
  );
}
