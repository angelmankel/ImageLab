/**
 * ModelSelectorModal — v1's full-screen model browser, ported onto this app's data.
 *
 * Search, base-model chips, a tile-size slider, a refresh button, and a grid of preview tiles
 * with a checkbox each. It is a full-screen modal, so it can never be clipped by a panel or the
 * side rail the way an anchored popover could.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon, Badge, Box, Card, Center, Checkbox, Chip, Divider, Group, Image,
  Modal, ScrollArea, Skeleton, Slider, Stack, Text, TextInput, Tooltip,
} from '@mantine/core';
import { IconHash, IconRefresh, IconSearch, IconServer, IconX, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { TileHover } from '@/components/ui/TileHover';
import { BASE_MODEL_BUCKETS } from '@/lib/modelHash';
import { readModelInfo, modelLabel, plainDescription, type ModelInfo } from './modelInfo';

export type ModelSelectorKind = 'checkpoint' | 'lora' | 'vae';

export interface ModelSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  kind: ModelSelectorKind;
  /** Every file name offered for this kind. */
  models: string[];
  selectedModels: string[];
  onToggleModel: (fileName: string) => void;
  onClearSelection?: () => void;
  /** Availability on the current routing target; unavailable models show dimmed with a hint. */
  availability?: (name: string) => { servers: string[]; enabled: boolean };
  onRefresh?: () => Promise<void> | void;
}

const TITLES: Record<ModelSelectorKind, string> = { checkpoint: 'Checkpoints', lora: 'LoRAs', vae: 'VAEs' };
const SCALE_KEY = 'imagelab.modelSelectorScale.v1';

export function ModelSelectorModal({
  opened, onClose, kind, models, selectedModels, onToggleModel, onClearSelection, availability, onRefresh,
}: ModelSelectorModalProps) {
  const [search, setSearch] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState<string | null>(null);
  const [scale, setScale] = useState(() => {
    try { const v = Number(localStorage.getItem(SCALE_KEY)); return Number.isFinite(v) && v > 0 ? v : 0.4; } catch { return 0.4; }
  });
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { try { localStorage.setItem(SCALE_KEY, String(scale)); } catch { /* ignore */ } }, [scale]);
  useEffect(() => { if (!opened) setSearch(''); }, [opened]);

  // Re-read metadata whenever the CivitAI cache fills in.
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);
  const infoMap = useMemo(() => {
    const m = new Map<string, ModelInfo>();
    for (const f of models) m.set(f, readModelInfo(f));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, hashes, civitai]);

  const baseModels = useMemo(() => {
    const present = new Set<string>();
    for (const i of infoMap.values()) present.add(i.bucket);
    return BASE_MODEL_BUCKETS.filter((b) => present.has(b));
  }, [infoMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((f) => {
      const info = infoMap.get(f);
      if (baseModelFilter && info?.bucket !== baseModelFilter) return false;
      if (!q) return true;
      return f.toLowerCase().includes(q) || (info?.name ?? '').toLowerCase().includes(q);
    });
  }, [models, search, baseModelFilter, infoMap]);

  // Selected first, then alphabetical — as v1 sorted. "Selected" is read once when the modal opens,
  // so ticking a tile never moves it (or its neighbours) out from under the pointer.
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(selectedModels));
  useEffect(() => { if (opened) setPinned(new Set(selectedModels)); }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => (
    [...filtered].sort((a, b) => Number(pinned.has(b)) - Number(pinned.has(a)) || modelLabel(a).localeCompare(modelLabel(b)))
  ), [filtered, pinned]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  // scale 0 = 8 columns (smallest), scale 1 = 3 columns (largest)
  const columns = Math.round(8 - scale * 5);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={TITLES[kind]}
      fullScreen
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '4px 12px 12px 12px' },
        header: { padding: '6px 12px', minHeight: 'unset' },
        title: { fontSize: '14px', fontWeight: 600 },
      }}
    >
      <Group gap="md" mb={6} wrap="nowrap" align="center">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap" align="center">
            <TextInput
              placeholder="Search models..."
              leftSection={<IconSearch size="0.875rem" />}
              rightSection={search && (
                <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => setSearch('')} aria-label="Clear search">
                  <IconX size="0.75rem" />
                </ActionIcon>
              )}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              size="sm"
              style={{ width: 250 }}
              data-autofocus
            />
            <Box style={{ flex: 1, minHeight: 28, minWidth: 0 }}>
              <ScrollArea type="never" scrollbars="x">
                <Chip.Group multiple={false} value={baseModelFilter || ''} onChange={(v) => setBaseModelFilter((v as string) || null)}>
                  <Group gap={6} wrap="nowrap">
                    <Chip value="" variant="light" size="xs">All</Chip>
                    {baseModels.map((m) => <Chip key={m} value={m} variant="light" size="xs">{m}</Chip>)}
                  </Group>
                </Chip.Group>
              </ScrollArea>
            </Box>
          </Group>
        </Box>

        <Group gap={6} style={{ flexShrink: 0 }} wrap="nowrap">
          <IconZoomOut size={14} style={{ opacity: 0.4 }} />
          <Slider value={scale} onChange={setScale} min={0} max={1} step={0.05} style={{ width: 100 }} label={null} size="xs" />
          <IconZoomIn size={14} style={{ opacity: 0.4 }} />
        </Group>

        {onRefresh && (
          <Tooltip label="Refresh models" position="bottom">
            <ActionIcon variant="subtle" size="sm" onClick={handleRefresh} loading={refreshing} style={{ flexShrink: 0 }} aria-label="Refresh models">
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        )}

        <Group gap="xs" style={{ flexShrink: 0 }}>
          <Text size="xs" c="dimmed">{filtered.length}</Text>
          <Badge variant="light" size="sm">{selectedModels.length} selected</Badge>
          {selectedModels.length > 0 && onClearSelection && (
            <Tooltip label="Clear selection" position="bottom">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={onClearSelection} aria-label="Clear selection">
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {sorted.length === 0 ? (
        <Center h={200}><Text c="dimmed">{models.length === 0 ? 'No models on the connected servers' : 'No models found'}</Text></Center>
      ) : (
        <ScrollArea scrollbars="y" style={{ flex: 1 }} type="auto" offsetScrollbars>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8, padding: 8 }}>
            {sorted.map((f) => (
              <ModelGridItem
                key={f}
                fileName={f}
                info={infoMap.get(f)}
                isSelected={selectedModels.includes(f)}
                availability={availability?.(f)}
                onToggle={onToggleModel}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </Modal>
  );
}

interface ModelGridItemProps {
  fileName: string;
  info?: ModelInfo;
  isSelected: boolean;
  availability?: { servers: string[]; enabled: boolean };
  onToggle: (fileName: string) => void;
}

const ModelGridItem = memo(function ModelGridItem({ fileName, info, isSelected, availability, onToggle }: ModelGridItemProps) {
  const [attempt, setAttempt] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const urls = info?.images ?? [];
  useEffect(() => { setAttempt(0); setImageLoaded(false); }, [urls.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const thumbnailUrl = urls[attempt];
  const allFailed = urls.length > 0 && attempt >= urls.length;
  const toggle = useCallback(() => onToggle(fileName), [onToggle, fileName]);
  const displayName = modelLabel(fileName);
  const unavailable = availability && !availability.enabled;
  const description = plainDescription(info?.description);

  const card = (
    <Card
      withBorder
      padding={0}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
        borderWidth: isSelected ? 2 : 1,
        transition: 'border-color 0.15s ease',
        overflow: 'hidden',
        opacity: unavailable ? 0.45 : 1,
      }}
      onClick={toggle}
    >
      <Box style={{ position: 'relative', aspectRatio: '1', backgroundColor: 'var(--mantine-color-dark-6)', overflow: 'hidden' }}>
        {thumbnailUrl && !allFailed ? (
          <>
            {!imageLoaded && <Skeleton style={{ position: 'absolute', inset: 0, zIndex: 0 }} />}
            <Image
              key={thumbnailUrl}
              src={thumbnailUrl}
              alt={displayName}
              fit="cover"
              loading="lazy"
              onError={() => { setAttempt((a) => a + 1); setImageLoaded(false); }}
              onLoad={() => setImageLoaded(true)}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                backgroundColor: 'var(--mantine-color-dark-7)', opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.15s ease',
              }}
            />
          </>
        ) : (
          <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text size="xs" c="dimmed" ta="center" px="xs">{info && !info.resolved ? 'Loading preview…' : 'No preview'}</Text>
          </Box>
        )}

        <Checkbox
          checked={isSelected}
          readOnly
          size="md"
          aria-label={`Select ${displayName}`}
          style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}
          styles={{ input: { backgroundColor: 'rgba(0, 0, 0, 0.5)', borderColor: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer' } }}
          onClick={(e) => { e.stopPropagation(); toggle(); }}
        />

        {info?.baseModel && (
          <Badge size="xs" variant="filled" color="dark" style={{ position: 'absolute', top: 6, left: 6, zIndex: 10 }}>
            {info.baseModel}
          </Badge>
        )}

        <Box
          px="xs"
          py={6}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.95))', paddingTop: '50px' }}
        >
          <Text size="md" fw={600} lineClamp={1} title={displayName} c="white">{displayName}</Text>
        </Box>
      </Box>
    </Card>
  );

  return (
    <TileHover width={320} position="right" content={
        <Stack gap="xs">
          <Text fw={600} size="sm" lineClamp={2}>{info?.name || displayName}</Text>
          {info?.baseModel && <Group gap="md"><Badge size="xs" variant="light">{info.baseModel}</Badge></Group>}
          {description && (
            <>
              <Divider />
              <Text size="xs" c="dimmed" lineClamp={4}>{description.slice(0, 300)}{description.length > 300 && '...'}</Text>
            </>
          )}
          {info && info.trainedWords.length > 0 && (
            <>
              <Divider />
              <Box>
                <Text size="xs" fw={500} mb={4}>Trigger words:</Text>
                <Group gap={4}>
                  {info.trainedWords.slice(0, 5).map((w, i) => <Badge key={i} size="xs" variant="outline" color="gray">{w}</Badge>)}
                  {info.trainedWords.length > 5 && <Text size="xs" c="dimmed">+{info.trainedWords.length - 5} more</Text>}
                </Group>
              </Box>
            </>
          )}
          <Divider />
          <Group gap="md">
            <Group gap={4}>
              <IconHash size={12} style={{ opacity: 0.5 }} />
              <Text size="xs" c="dimmed" ff="monospace">{info?.hash?.slice(0, 8) || '—'}</Text>
            </Group>
            {availability && (
              <Group gap={4}>
                <IconServer size={12} style={{ opacity: 0.5 }} />
                <Text size="xs" c={availability.enabled ? 'dimmed' : 'orange'}>
                  {availability.servers.length ? availability.servers.join(', ') : 'Not installed'}
                </Text>
              </Group>
            )}
          </Group>
          <Text size="xs" c="dimmed" lineClamp={1}>{fileName}</Text>
        </Stack>
    }>
      {card}
    </TileHover>
  );
});
