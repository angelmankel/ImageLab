import { useState } from 'react';
import {
  ActionIcon, Anchor, Badge, Button, Group, Menu, NumberInput, Paper, SegmentedControl, Select, Stack,
  Text, Tooltip,
} from '@mantine/core';
import {
  IconCheck, IconCopy, IconDownload, IconHeart, IconHeartFilled, IconPhoto, IconPlaylistAdd,
  IconPlus, IconSparkles, IconTrash, IconX,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { getImportedBlob } from '@/lib/importedDb';
import {
  blobToDataUrl,
  describeImage,
  httpUrlToDataUrl,
  promptFromImage,
  tagImage,
  TAG_COUNT_DEFAULT, TAG_COUNT_MIN, TAG_COUNT_MAX,
  VENICE_VISION_MODELS,
  type DescribeLength,
  type TagStyle,
} from '@/lib/venice';
import type { Tile } from './useCollectionTiles';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/**
 * Right-side detail drawer. Always mounted — when no tile is selected,
 * shows a lightweight empty state. The previous behavior toggled this
 * column between present/absent and the grid had to reflow each time,
 * which the user (rightly) called out as jarring; keeping the column
 * stable means tile sizes never change between selection states.
 *
 * Layout: small preview at the top, compact metadata, then a single
 * Venice section that groups Tag / Describe / Prompt into tabs to stop
 * the body from running long. Each tab keeps its result inline so users
 * see the most-recent output without expanding anything.
 */
export function CollectionDetail({ tile, onClose }: { tile: Tile | null; onClose: () => void }) {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border-subtle bg-bg-panel">
      <Group gap="xs" wrap="nowrap" px="sm" py={8} mih={45} component="header" className="shrink-0 border-b border-border-subtle">
        <Text size="sm" fw={600} truncate className="min-w-0 flex-1" title={tile?.title}>
          {tile?.title ?? 'No image selected'}
        </Text>
        {tile && (
          <Tooltip label="Clear selection" withArrow>
            <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Clear selection">
              <IconX size={15} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {tile && <TileActionRow tile={tile} />}
      {tile ? <DetailBody tile={tile} /> : <EmptyState />}
    </aside>
  );
}

function TileActionRow({ tile }: { tile: Tile }) {
  const toggleHistoryLiked = useStore((s) => s.toggleHistoryLiked);
  const toggleImportedLiked = useStore((s) => s.toggleImportedLiked);
  const removeHistoryEntry = useStore((s) => s.removeHistoryEntry);
  const removeImportedImage = useStore((s) => s.removeImportedImage);
  const removeServerFavorite = useStore((s) => s.removeServerFavorite);
  const removeItemFromAllCollections = useStore((s) => s.removeItemFromAllCollections);
  const confirm = useConfirm();

  const toggleLiked = () => {
    if (tile.source === 'history') toggleHistoryLiked(tile.id);
    else if (tile.source === 'import') toggleImportedLiked(tile.id);
    // For a server favorite the only meaningful "unfavorite" is to remove
    // it from disk — there's no local-only "starred" bit to flip.
    else if (tile.source === 'favorite' && tile.favorite) {
      removeServerFavorite(tile.favorite.serverId, tile.favorite.id);
    }
  };
  const deleteTile = async () => {
    const label =
      tile.source === 'history'  ? 'this generated image' :
      tile.source === 'favorite' ? 'this favorite from the server' :
                                   'this imported image';
    if (!await confirm(`Delete ${label}?`)) return;
    if (tile.source === 'history') { removeHistoryEntry(tile.id); removeItemFromAllCollections(tile.id); }
    else if (tile.source === 'import') removeImportedImage(tile.id);
    else if (tile.source === 'favorite' && tile.favorite) removeServerFavorite(tile.favorite.serverId, tile.favorite.id);
  };

  return (
    <Group gap={6} wrap="nowrap" px="sm" py={8} className="shrink-0 border-b border-border-subtle bg-bg-panel/60">
      <Tooltip label={tile.liked ? 'Unfavorite' : 'Favorite'} withArrow>
        <ActionIcon
          size="lg"
          variant={tile.liked ? 'light' : 'default'}
          color={tile.liked ? 'red' : undefined}
          onClick={toggleLiked}
          aria-label={tile.liked ? 'Unfavorite' : 'Favorite'}
          aria-pressed={!!tile.liked}
        >
          {tile.liked ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
        </ActionIcon>
      </Tooltip>
      <AddToCollectionButton tileId={tile.id} />
      <div className="flex-1" />
      <Tooltip label="Delete" withArrow>
        <ActionIcon size="lg" variant="default" onClick={deleteTile} aria-label="Delete image" className="hover:!text-[var(--mantine-color-red-5)]">
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function AddToCollectionButton({ tileId }: { tileId: string }) {
  const collections = useStore((s) => s.collections);
  const addToCollection = useStore((s) => s.addToCollection);
  const removeFromCollection = useStore((s) => s.removeFromCollection);
  const createCollection = useStore((s) => s.createCollection);
  const [open, setOpen] = useState(false);

  return (
    // Stays open on toggle, so several collections can be ticked in one visit.
    <Menu opened={open} onChange={setOpen} closeOnItemClick={false} position="bottom-start" width={224} shadow="md" withinPortal>
      <Menu.Target>
        <Tooltip label="Add to collection" withArrow disabled={open}>
          <ActionIcon size="lg" variant="default" aria-label="Add to collection">
            <IconPlaylistAdd size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {collections.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic" px="xs" py={8}>No collections yet — create one from the rail.</Text>
        ) : (
          collections.map((c) => {
            const isMember = c.itemIds.includes(tileId);
            return (
              <Menu.Item
                key={c.id}
                onClick={() => isMember ? removeFromCollection(c.id, tileId) : addToCollection(c.id, tileId)}
                leftSection={
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="w-3">{isMember && <IconCheck size={12} />}</span>
                    <span aria-hidden className="text-[11px]">{c.icon ?? '📁'}</span>
                  </span>
                }
                rightSection={<Text size="10px" c="dimmed" className="tabular-nums">{c.itemIds.length}</Text>}
              >
                <Text size="sm" truncate>{c.name}</Text>
              </Menu.Item>
            );
          })
        )}
        <Menu.Divider />
        <Menu.Item
          color="teal"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            const name = prompt('New collection name')?.trim();
            if (!name) return;
            const id = createCollection(name);
            addToCollection(id, tileId);
            setOpen(false);
          }}
        >
          New collection…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function EmptyState() {
  return (
    <Stack align="center" justify="center" gap={6} px="lg" ta="center" className="min-h-0 flex-1">
      <IconPhoto size={36} className="text-[var(--mantine-color-dimmed)]" />
      <Text size="sm" fw={500}>No image selected</Text>
      <Text size="xs" c="dimmed" lh={1.5}>
        Click any tile to load metadata and Venice AI tools here.
        Click it again to open the fullscreen viewer.
      </Text>
    </Stack>
  );
}

function DetailBody({ tile }: { tile: Tile }) {
  const venice = useStore((s) => s.venice);
  const setItemAi = useStore((s) => s.setItemAi);
  const addLayer = useStore((s) => s.addLayer);
  const layers = useStore((s) => s.layers);
  const removeLayer = useStore((s) => s.removeLayer);
  const setStatus = useStore((s) => s.setStatus);

  const [tab, setTab] = useState<'tags' | 'describe' | 'prompt'>('tags');
  const [tagStyle, setTagStyle] = useState<TagStyle>('danbooru');
  const [tagCount, setTagCount] = useState<number>(TAG_COUNT_DEFAULT);
  const [descLength, setDescLength] = useState<DescribeLength>('detailed');
  const [visionModel, setVisionModel] = useState<string>(VENICE_VISION_MODELS[0].id);

  /** Tag <-> layer matching: when a tag is "added as a layer" we use
   *  tag='AI' + the tag text. To toggle a single tag back off we look for
   *  any positive layer with those two fields matching. Match is text-only
   *  so a layer added by hand with the same text is also considered "on". */
  const findLayerForTag = (tag: string) =>
    layers.find((l) => l.kind === 'positive' && l.tag === 'AI' && l.text === tag);

  const toggleTagLayer = (tag: string) => {
    const existing = findLayerForTag(tag);
    if (existing) {
      removeLayer(existing.id);
    } else {
      addLayer('positive', { tag: 'AI', text: tag, weight: 1.0 });
    }
  };

  const [running, setRunning] = useState<null | 'tag' | 'describe' | 'prompt'>(null);
  const [error, setError] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard(1100);

  /** Resolve the image bytes for whichever tile is selected — imports come
   *  from IDB, history fetches the ComfyUI `/view?…` URL through the
   *  browser. Returns a data URL ready to feed Venice. */
  const resolveImageDataUrl = async (): Promise<string> => {
    if (tile.source === 'import') {
      const blob = await getImportedBlob(tile.id);
      if (!blob) throw new Error('Imported image blob is missing — was it cleared from the browser?');
      return blobToDataUrl(blob);
    }
    if (!tile.thumbnailUrl) throw new Error("Can't reach this image — is the source server online?");
    return httpUrlToDataUrl(tile.thumbnailUrl);
  };

  const settingsWithModel = { ...venice, model: visionModel || venice.model };

  const runTag = async () => {
    setRunning('tag'); setError(null);
    try {
      const dataUrl = await resolveImageDataUrl();
      const { tags } = await tagImage(dataUrl, tagStyle, settingsWithModel, { maxTags: tagCount });
      if (!tags.length) throw new Error('Venice returned no tags. Try a different style or model.');
      setItemAi(tile.id, { tags });
      setStatus(`Tagged ${tags.length} tags from Venice`, 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const runDescribe = async () => {
    setRunning('describe'); setError(null);
    try {
      const dataUrl = await resolveImageDataUrl();
      const description = await describeImage(dataUrl, descLength, settingsWithModel);
      if (!description) throw new Error('Venice returned an empty description.');
      setItemAi(tile.id, { description });
      setStatus('Description ready', 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const runPrompt = async () => {
    setRunning('prompt'); setError(null);
    try {
      const dataUrl = await resolveImageDataUrl();
      const aiPrompt = await promptFromImage(dataUrl, settingsWithModel);
      if (!aiPrompt) throw new Error('Venice returned an empty prompt.');
      setItemAi(tile.id, { aiPrompt });
      setStatus('Prompt generated', 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  };

  const addTagsAsLayers = () => {
    if (!tile.tags?.length) return;
    let added = 0;
    for (const tag of tile.tags) {
      if (findLayerForTag(tag)) continue; // already on — don't duplicate
      addLayer('positive', { tag: 'AI', text: tag, weight: 1.0 });
      added++;
    }
    if (added) setStatus(`Added ${added} tags as layers`, 'ok');
    else setStatus('All tags already added', 'ok');
  };

  return (
    <div className="scroll-y flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
      {/* Preview — smaller now (16rem max) so the AI tools below get more
          room without scrolling. */}
      <Paper withBorder radius="md" bg="dark.8" className="flex max-h-[240px] items-center justify-center overflow-hidden">
        {tile.thumbnailUrl ? (
          <img src={tile.thumbnailUrl} alt="" className="max-h-[240px] max-w-full object-contain" />
        ) : (
          <IconPhoto size={36} className="text-[var(--mantine-color-dimmed)]" />
        )}
      </Paper>

      {/* Metadata — single-line chips instead of a 2-col dl, easier to scan. */}
      <Group gap={4}>
        <MetaChip
          label={tile.source === 'history' ? 'Generated' : tile.source === 'favorite' ? 'Favorited' : 'Imported'}
          accent
        />
        {tile.width && tile.height && <MetaChip label={`${tile.width}×${tile.height}`} />}
        {tile.source === 'history' && tile.history?.model && (
          <MetaChip label={truncate(tile.history.model, 32)} title={tile.history.model} />
        )}
        {tile.source === 'history' && tile.history && (
          <MetaChip label={`seed ${tile.history.seed}`} />
        )}
        {tile.source === 'import' && tile.imported && (
          <MetaChip label={formatBytes(tile.imported.bytes)} />
        )}
        {tile.source === 'import' && tile.thumbnailUrl && (
          <Anchor
            href={tile.thumbnailUrl}
            download={tile.imported?.name || 'image.png'}
            title="Download original"
            size="xs"
            className="inline-flex items-center gap-1"
          >
            <IconDownload size={12} />
            Download
          </Anchor>
        )}
      </Group>

      {/* Venice AI block — tabs replace the old three stacked Sections. */}
      <Paper withBorder radius="md" p="xs" className="flex flex-col gap-2">
        {!venice.apiKey ? (
          <Text size="xs" c="dimmed">
            Add a Venice API key in Settings → AI to enable tagging, descriptions, and image-to-prompt.
          </Text>
        ) : (
          <>
            <Group gap={6} wrap="nowrap">
              <SegmentedControl
                size="xs"
                className="flex-1"
                value={tab}
                onChange={(v) => setTab(v as typeof tab)}
                data={[
                  { value: 'tags', label: 'Tags' },
                  { value: 'describe', label: 'Describe' },
                  { value: 'prompt', label: 'Prompt' },
                ]}
              />
              <Select
                size="xs"
                w={120}
                aria-label="Vision model"
                value={visionModel}
                onChange={(v) => { if (v) setVisionModel(v); }}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true, shadow: 'md', width: 200, position: 'bottom-end' }}
                title={VENICE_VISION_MODELS.find((m) => m.id === visionModel)?.note ?? ''}
                data={VENICE_VISION_MODELS.map((m) => ({ value: m.id, label: m.label }))}
              />
            </Group>

            {error && (
              <Paper radius="sm" px="xs" py={4} bg="rgba(250, 82, 82, 0.1)" style={{ border: '1px solid rgba(250, 82, 82, 0.4)' }}>
                <Text size="xs" c="red.5">{error}</Text>
              </Paper>
            )}

            {tab === 'tags' && (
              <div className="flex flex-col gap-2">
                <Group gap={6} wrap="nowrap">
                  <Select
                    size="xs"
                    w={110}
                    aria-label="Tag style"
                    value={tagStyle}
                    onChange={(v) => { if (v) setTagStyle(v as TagStyle); }}
                    allowDeselect={false}
                    disabled={running === 'tag'}
                    comboboxProps={{ withinPortal: true, shadow: 'md' }}
                    data={[
                      { value: 'danbooru', label: 'Danbooru' },
                      { value: 'natural', label: 'Natural' },
                      { value: 'sdxl', label: 'SDXL prompt' },
                    ]}
                  />
                  <Tooltip label="How many tags to request" withArrow>
                    <NumberInput
                      size="xs"
                      w={56}
                      aria-label="Tag count"
                      leftSection={<Text size="xs" c="dimmed">#</Text>}
                      leftSectionWidth={20}
                      value={tagCount}
                      onChange={(v) => setTagCount(Math.max(TAG_COUNT_MIN, Math.min(TAG_COUNT_MAX, Number(v) || TAG_COUNT_DEFAULT)))}
                      min={TAG_COUNT_MIN}
                      max={TAG_COUNT_MAX}
                      step={1}
                      disabled={running === 'tag'}
                    />
                  </Tooltip>
                  <Button
                    size="xs"
                    className="flex-1"
                    leftSection={<IconSparkles size={13} />}
                    onClick={runTag}
                    disabled={!venice.apiKey || running !== null}
                  >
                    {running === 'tag' ? 'Tagging…' : tile.tags?.length ? 'Re-tag' : 'Tag image'}
                  </Button>
                </Group>
                {tile.tags && tile.tags.length > 0 && (
                  <>
                    <Text size="10px" c="dimmed">
                      Click a tag to add it as a positive prompt layer · click again to remove
                    </Text>
                    <Group gap={4}>
                      {tile.tags.map((t, i) => {
                        const on = !!findLayerForTag(t);
                        return (
                          <Badge
                            key={`${t}-${i}`}
                            component="button"
                            type="button"
                            onClick={() => toggleTagLayer(t)}
                            title={on ? 'Remove from layers' : 'Add as positive layer'}
                            aria-pressed={on}
                            size="sm"
                            radius="sm"
                            tt="none"
                            fw={500}
                            variant={on ? 'filled' : 'default'}
                            className="cursor-pointer"
                          >
                            {t}
                          </Badge>
                        );
                      })}
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      <Button
                        size="xs"
                        variant="default"
                        className="flex-1"
                        leftSection={<IconPlus size={13} />}
                        onClick={addTagsAsLayers}
                        title="Add every tag as a positive prompt layer"
                      >
                        Add all as layers
                      </Button>
                      <CopyButton
                        copied={copied === 'tags'}
                        onClick={() => void copy(tile.tags!.join(', '), 'tags')}
                        title="Copy comma-separated tags"
                      />
                    </Group>
                  </>
                )}
              </div>
            )}

            {tab === 'describe' && (
              <div className="flex flex-col gap-2">
                <Group gap={6} wrap="nowrap">
                  <Select
                    size="xs"
                    w={110}
                    aria-label="Description length"
                    value={descLength}
                    onChange={(v) => { if (v) setDescLength(v as DescribeLength); }}
                    allowDeselect={false}
                    disabled={running === 'describe'}
                    comboboxProps={{ withinPortal: true, shadow: 'md' }}
                    data={[
                      { value: 'short', label: 'Short' },
                      { value: 'detailed', label: 'Detailed' },
                    ]}
                  />
                  <Button
                    size="xs"
                    className="flex-1"
                    leftSection={<IconSparkles size={13} />}
                    onClick={runDescribe}
                    disabled={!venice.apiKey || running !== null}
                  >
                    {running === 'describe' ? 'Describing…' : tile.description ? 'Re-describe' : 'Describe'}
                  </Button>
                </Group>
                {tile.description && (
                  <ResultBlock
                    text={tile.description}
                    copied={copied === 'description'}
                    onCopy={() => void copy(tile.description!, 'description')}
                  />
                )}
              </div>
            )}

            {tab === 'prompt' && (
              <div className="flex flex-col gap-2">
                <Button
                  size="xs"
                  fullWidth
                  leftSection={<IconSparkles size={13} />}
                  onClick={runPrompt}
                  disabled={!venice.apiKey || running !== null}
                >
                  {running === 'prompt' ? 'Writing…' : tile.aiPrompt ? 'Re-generate prompt' : 'Generate prompt'}
                </Button>
                {tile.aiPrompt && (
                  <ResultBlock
                    text={tile.aiPrompt}
                    copied={copied === 'prompt'}
                    onCopy={() => void copy(tile.aiPrompt!, 'prompt')}
                  />
                )}
              </div>
            )}
          </>
        )}
      </Paper>

      {tile.source === 'history' && tile.history?.positive && (
        <Paper component="details" withBorder radius="md" px="xs" py={6}>
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--mantine-color-dimmed)]">
            Original prompt
          </summary>
          <Text size="xs" mt={6} className="whitespace-pre-line">
            {tile.history.positive}
          </Text>
        </Paper>
      )}
    </div>
  );
}

// ─── Small atoms ────────────────────────────────────────────────────────────

function MetaChip({ label, accent, title }: { label: string; accent?: boolean; title?: string }) {
  return (
    <Badge title={title} size="sm" radius="sm" tt="none" fw={500} variant={accent ? 'light' : 'default'}>
      {label}
    </Badge>
  );
}

function ResultBlock({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: () => void }) {
  return (
    <Stack gap={6}>
      <Paper radius="sm" px="xs" py={6} bg="dark.6">
        <Text size="xs" className="whitespace-pre-line">{text}</Text>
      </Paper>
      <CopyButton copied={copied} onClick={onCopy} title="Copy" full />
    </Stack>
  );
}

function CopyButton({ copied, onClick, title, full }: { copied: boolean; onClick: () => void; title: string; full?: boolean }) {
  return (
    <Button
      size="xs"
      variant="default"
      fullWidth={full}
      title={title}
      color={copied ? 'teal' : undefined}
      leftSection={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      onClick={onClick}
    >
      {copied ? 'Copied' : title}
    </Button>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
