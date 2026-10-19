/**
 * Prompts from CivitAI for the models on this server. Opened from the picture-search button on
 * the Prompt box. The left rail lists every installed checkpoint and LoRA that CivitAI knows
 * (hash → version); the grid shows that version's gallery with each picture's prompt, straight
 * from the Images API (the only endpoint that keeps `meta`). "Use prompt" replaces the Prompt and
 * Negative boxes with Undo; "+ settings" also copies steps, CFG and seed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  ActionIcon, Badge, Box, Button, Group, Loader, Modal, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput,
  Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconArrowLeft, IconExternalLink, IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import {
  civitaiThumbUrl, fetchCivitaiImages, isCivitaiVideo, type CivitaiImage, type CivitaiVersionByHash, type NsfwFilter,
} from '@/lib/civitai';
import { modelLabel } from '@/components/models/modelInfo';
import { applyWithUndo } from './PresetLibraryModal';

type Installed = { file: string; versionId: number; modelId: number; model: string; version: string; type: string; preview?: string };

const NSFW_KEY = 'imagelab.civitaiPrompts.nsfw';
const typeRank = (t: string) => (t === 'Checkpoint' ? 0 : /lora|locon|dora/i.test(t) ? 1 : 2);

/** Every installed file CivitAI resolved, current checkpoint and LoRAs first. */
function useInstalled(): Installed[] {
  const hashes = useStore((s) => s.modelHashes);
  const byHash = useStore((s) => s.civitaiByHash);
  const checkpoint = useStore((s) => s.workflow.checkpoints[0]?.name);
  const loras = useStore((s) => s.workflow.loras);
  return useMemo(() => {
    const active = new Set([checkpoint, ...loras.map((l) => l.name)].filter(Boolean));
    const seen = new Set<number>();
    const list: Installed[] = [];
    for (const h of hashes) {
      const e = byHash[h.hash];
      if (!e || e.status !== 'found') continue;
      const d = e.data as CivitaiVersionByHash;
      if (!d?.id || seen.has(d.id)) continue;
      seen.add(d.id);
      list.push({ file: h.filename, versionId: d.id, modelId: d.modelId, model: d.model?.name ?? modelLabel(h.filename), version: d.name, type: d.model?.type ?? '', preview: d.images?.[0]?.url });
    }
    const isActive = (m: Installed) => [...active].some((a) => a && (m.file === a || m.file.endsWith(`/${a}`) || a.endsWith(`/${m.file}`) || modelLabel(a) === modelLabel(m.file)));
    return list.sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || typeRank(a.type) - typeRank(b.type) || a.model.localeCompare(b.model));
  }, [hashes, byHash, checkpoint, loras]);
}

export function CivitaiPromptsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const installed = useInstalled();
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [nsfw, setNsfw] = useState<NsfwFilter>(() => (localStorage.getItem(NSFW_KEY) as NsfwFilter) || 'all');
  const [items, setItems] = useState<CivitaiImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<CivitaiImage | null>(null);
  const gen = useRef(0);

  const model = installed.find((m) => m.versionId === picked) ?? installed[0] ?? null;
  useEffect(() => { if (opened && picked == null && installed[0]) setPicked(installed[0].versionId); }, [opened, installed, picked]);
  useEffect(() => { localStorage.setItem(NSFW_KEY, nsfw); }, [nsfw]);

  const load = async (versionId: number, next: string | null, append: boolean) => {
    const my = ++gen.current;
    setLoading(true); setFailed(false);
    // CivitAI pages are 10; pull a few at once so the grid fills.
    const got: CivitaiImage[] = []; let c = next;
    for (let i = 0; i < 3; i++) {
      const page = await fetchCivitaiImages(versionId, c, nsfw);
      if (my !== gen.current) return;
      if (!page) { setFailed(got.length === 0 && !append); break; }
      got.push(...page.items); c = page.nextCursor; if (!c) break;
    }
    const usable = got.filter((i) => !isCivitaiVideo(i) && i.meta?.prompt);
    setItems((prev) => (append ? [...prev, ...usable] : usable));
    setCursor(c); setLoading(false);
  };
  useEffect(() => { if (opened && model) { setItems([]); setOpen(null); void load(model.versionId, null, false); } }, [opened, model?.versionId, nsfw]);

  const visibleModels = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? installed.filter((m) => `${m.model} ${m.version} ${m.file}`.toLowerCase().includes(q)) : installed;
  }, [installed, filter]);

  const use = (img: CivitaiImage, withSettings: boolean) => {
    const m = img.meta!;
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
          {installed.length === 0 && <Text size="xs" c="dimmed" p="xs">No installed model is known to CivitAI yet. Hashes may still be loading.</Text>}
        </Stack>
      </ScrollArea>
    </Stack>
  );

  const detail = open && (
    <Stack p="md" gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between">
        <Button size="xs" variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => setOpen(null)}>Back to the grid</Button>
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => use(open, true)}>Use prompt + settings</Button>
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
          {loading ? <Loader size="sm" /> : cursor && model ? <Button variant="default" size="xs" onClick={() => load(model.versionId, cursor, true)}>Load more</Button> : null}
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
