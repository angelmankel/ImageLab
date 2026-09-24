/**
 * SnippetsModal — v1's snippet browser, on this app's snippet library.
 *
 * Categories down the left with a count of how many of their snippets are in the prompt, a search
 * box, and a grid of snippet cards. Clicking a card adds it to the prompt as a part, or takes it
 * back out. Each card's menu edits or deletes the snippet itself. Full presets (a whole saved
 * prompt) are listed too; clicking one inserts all its parts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  ActionIcon, Badge, Box, Button, Center, Group, Menu, Modal, Paper, ScrollArea, SegmentedControl, SimpleGrid,
  Stack, Text, TextInput, Textarea, Tooltip, UnstyledButton, Select,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconDots, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { applyPromptPreset } from '@/lib/promptPresets';
import { DEFAULT_CATEGORY_ID, uid } from '@/lib/storage';
import type { LayerKind, Snippet } from '@/lib/types';

const PALETTE = ['yellow', 'teal', 'blue', 'cyan', 'grape', 'orange', 'pink', 'green', 'violet', 'indigo', 'lime', 'red'];

/** A stable Mantine colour per category, as v1 gave each category its own. */
export function categoryColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const ALL = '__all__';

/**
 * Where the library was left — category and Positive/Negative filter per prompt kind, kept across
 * reloads, and the list's scroll position per view, saved when the window closes — so reopening lands on
 * the same spot instead of "All" at the top.
 */
const PLACE_KEY = 'imagelab.snippets.lastPlace.v1';
type Place = { tab: string; showKind: LayerKind | 'all' };
function loadPlace(kind: LayerKind): Place {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) || '{}')[kind];
    if (p && typeof p.tab === 'string') return { tab: p.tab, showKind: p.showKind ?? kind };
  } catch { /* fall through */ }
  return { tab: ALL, showKind: kind };
}
function savePlace(kind: LayerKind, place: Place) {
  try {
    const all = JSON.parse(localStorage.getItem(PLACE_KEY) || '{}');
    localStorage.setItem(PLACE_KEY, JSON.stringify({ ...all, [kind]: place }));
  } catch { /* ignore */ }
}
const SCROLL_KEY = 'imagelab.snippets.scroll.v1';
const scrollMemo = new Map<string, number>((() => {
  try { return Object.entries(JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}')) as [string, number][]; } catch { return []; }
})());
function saveScrollMemo() {
  try { localStorage.setItem(SCROLL_KEY, JSON.stringify(Object.fromEntries(scrollMemo))); } catch { /* ignore */ }
}

export function SnippetsModal({ opened, onClose, kind }: { opened: boolean; onClose: () => void; kind: LayerKind }) {
  const snippets = useStore((s) => s.snippets);
  const categories = useStore((s) => s.snippetCategories);
  const layers = useStore((s) => s.layers);
  const [activeTab, setActiveTab] = useState<string>(() => loadPlace(kind).tab);
  const [search, setSearch] = useState('');
  const [showKind, setShowKind] = useState<LayerKind | 'all'>(() => loadPlace(kind).showKind);
  const [editing, setEditing] = useState<Snippet | 'new' | null>(null);
  // Phones get a full-screen sheet: categories as a sideways-scrolling chip row, cards full width.
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;

  // A category deleted since it was saved falls back to All.
  const tab = activeTab === ALL || categories.some((c) => c.id === activeTab) ? activeTab : ALL;
  useEffect(() => { savePlace(kind, { tab, showKind }); }, [kind, tab, showKind]);

  // Restore the list's scroll for this view when the window opens or the view changes.
  const listRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const scrollKey = `${kind}:${tab}:${showKind}`;
  useEffect(() => {
    if (!opened) return;
    const id = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = scrollMemo.get(scrollKey) ?? 0;
      chipsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [opened, scrollKey, narrow]);
  const onListScroll = ({ y }: { y: number }) => { if (!search) scrollMemo.set(scrollKey, y); };
  useEffect(() => { if (!opened) saveScrollMemo(); }, [opened]);

  const inPrompt = useMemo(() => new Set(layers.map((l) => l.originSnippetId).filter(Boolean)), [layers]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snippets.filter((s) =>
      (showKind === 'all' || s.kind === showKind || s.layers?.some((l) => l.kind === showKind))
      && (tab === ALL || s.categoryId === tab)
      && (!q || `${s.name} ${s.tag} ${s.text} ${s.layers?.map((l) => l.text).join(' ') ?? ''}`.toLowerCase().includes(q)));
  }, [snippets, showKind, tab, search]);

  const countIn = (categoryId: string) => snippets.filter((s) => (categoryId === ALL || s.categoryId === categoryId) && inPrompt.has(s.id)).length;

  const toggle = (s: Snippet) => {
    const st = useStore.getState();
    if (s.layers) { st.setPromptLayers(applyPromptPreset(st.layers, s, 'insert', uid)); return; }
    if (inPrompt.has(s.id)) st.removeLayersFromSnippet(s.id);
    else st.insertSnippetAsLayer(s.id);
  };

  const confirmDelete = (s: Snippet) => modals.openConfirmModal({
    title: 'Delete Snippet',
    children: <Text size="sm">Are you sure you want to delete &quot;{s.name}&quot;? This action cannot be undone.</Text>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: 400,
    onConfirm: () => useStore.getState().removeSnippet(s.id),
  });

  const tabs = [{ id: ALL, name: 'All' }, ...categories];

  const saveCurrent = () => {
    const first = layers.find((l) => l.kind === 'positive' && l.text.trim())?.text.trim() ?? 'Prompt';
    useStore.getState().addSnippet({
      name: first.split(/\s+/).slice(0, 5).join(' '),
      text: layers.filter((l) => l.kind === 'positive').map((l) => l.text).join(', '),
      kind: 'positive', tag: '', weight: 1, categoryId: tab === ALL ? DEFAULT_CATEGORY_ID : tab,
      layers: layers.map(({ kind, text, tag, weight, on }) => ({ kind, text, tag, weight, on })),
    });
    notifications.show({ title: 'Preset saved', message: 'The whole prompt is now a preset in this list', color: 'green' });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm" wrap="wrap">
            <Text fw={600} size="lg">Snippets</Text>
            <Tooltip label="Create new snippet">
              <ActionIcon variant="light" size="sm" onClick={() => setEditing('new')} aria-label="Create new snippet">
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Save the whole current prompt (every part, positive and negative) as one preset">
              <Button size="compact-xs" variant="subtle" leftSection={<IconDeviceFloppy size={14} />} onClick={saveCurrent} disabled={!layers.some((l) => l.text.trim())}>
                Save current prompt
              </Button>
            </Tooltip>
          </Group>
        }
        size="80vw"
        centered
        fullScreen={narrow}
        styles={{
          content: narrow ? { display: 'flex', flexDirection: 'column' } : { maxWidth: 1200, height: '80vh', maxHeight: 800, display: 'flex', flexDirection: 'column' },
          body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 },
          header: { padding: narrow ? 'var(--mantine-spacing-sm)' : 'var(--mantine-spacing-md)', borderBottom: '1px solid var(--mantine-color-dark-4)' },
        }}
      >
        {narrow ? (
          <Stack gap={0} style={{ flex: 1, overflow: 'hidden' }}>
            <Stack gap="xs" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
              <TextInput
                placeholder={`Search ${tab === ALL ? 'snippets' : tabs.find((t) => t.id === tab)?.name ?? ''}...`}
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                size="sm"
              />
              <SegmentedControl
                size="sm" fullWidth
                value={showKind}
                onChange={(v) => setShowKind(v as LayerKind | 'all')}
                data={[{ label: 'Positive', value: 'positive' }, { label: 'Negative', value: 'negative' }, { label: 'All', value: 'all' }]}
              />
              <ScrollArea type="never" scrollbars="x">
                <Group gap={6} wrap="nowrap" pb={2} ref={chipsRef}>
                  {tabs.map((cat) => {
                    const isActive = tab === cat.id;
                    const count = countIn(cat.id);
                    return (
                      <Button key={cat.id} data-active={isActive} size="compact-md" radius="xl" variant={isActive ? 'filled' : 'default'} color={categoryColor(cat.id)}
                        onClick={() => { setActiveTab(cat.id); setSearch(''); }} style={{ flexShrink: 0 }}
                        rightSection={count > 0 ? <Badge size="xs" circle color="dark">{count}</Badge> : undefined}>
                        {'icon' in cat && cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </Button>
                    );
                  })}
                </Group>
              </ScrollArea>
            </Stack>
            <ScrollArea scrollbars="y" style={{ flex: 1 }} p="sm" viewportRef={listRef} onScrollPositionChange={onListScroll}>
              {visible.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                  {visible.map((s) => (
                    <SnippetCard
                      key={s.id}
                      snippet={s}
                      isSelected={inPrompt.has(s.id)}
                      onToggle={() => toggle(s)}
                      onEdit={() => setEditing(s)}
                      onDelete={() => confirmDelete(s)}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <Text c="dimmed" ta="center">{snippets.length ? `No snippets found${search ? ` matching "${search}"` : ''}` : 'No snippets yet.'}</Text>
                    <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>Create Custom</Button>
                  </Stack>
                </Center>
              )}
            </ScrollArea>
            <Group justify="space-between" p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
              <Text size="sm" c="dimmed">{inPrompt.size} in the prompt</Text>
              <Button onClick={onClose}>Done</Button>
            </Group>
          </Stack>
        ) : (
        <Group align="stretch" gap={0} style={{ flex: 1, overflow: 'hidden' }} wrap="nowrap">
          <Box style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--mantine-color-dark-4)', display: 'flex', flexDirection: 'column' }}>
            <ScrollArea scrollbars="y" style={{ flex: 1 }} p="sm">
              <Stack gap={4}>
                {tabs.map((cat) => {
                  const isActive = tab === cat.id;
                  const count = countIn(cat.id);
                  const color = categoryColor(cat.id);
                  return (
                    <UnstyledButton
                      key={cat.id}
                      onClick={() => { setActiveTab(cat.id); setSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
                        backgroundColor: isActive ? 'var(--mantine-color-dark-5)' : 'transparent', transition: 'background-color 0.15s ease',
                      }}
                    >
                      <Box style={{ width: 16, textAlign: 'center', color: isActive ? `var(--mantine-color-${color}-5)` : 'var(--mantine-color-dimmed)' }}>
                        {'icon' in cat && cat.icon ? cat.icon : '•'}
                      </Box>
                      <Text size="sm" fw={isActive ? 600 : 400} style={{ flex: 1, color: isActive ? 'var(--mantine-color-white)' : 'var(--mantine-color-dimmed)' }} truncate>
                        {cat.name}
                      </Text>
                      {count > 0 && <Badge size="sm" variant="filled" color={color} radius="xl">{count}</Badge>}
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
            <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
              <Text size="xs" c="dimmed" ta="center">{inPrompt.size} in the prompt</Text>
            </Box>
          </Box>

          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Group p="md" gap="sm" wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
              <TextInput
                placeholder={`Search ${tab === ALL ? 'snippets' : tabs.find((t) => t.id === tab)?.name ?? ''}...`}
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                size="sm"
                style={{ flex: 1 }}
                data-autofocus
              />
              <SegmentedControl
                size="xs"
                value={showKind}
                onChange={(v) => setShowKind(v as LayerKind | 'all')}
                data={[{ label: 'Positive', value: 'positive' }, { label: 'Negative', value: 'negative' }, { label: 'All', value: 'all' }]}
              />
            </Group>
            <ScrollArea scrollbars="y" style={{ flex: 1 }} p="md" viewportRef={listRef} onScrollPositionChange={onListScroll}>
              {visible.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                  {visible.map((s) => (
                    <SnippetCard
                      key={s.id}
                      snippet={s}
                      isSelected={inPrompt.has(s.id)}
                      onToggle={() => toggle(s)}
                      onEdit={() => setEditing(s)}
                      onDelete={() => confirmDelete(s)}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <Text c="dimmed" ta="center">{snippets.length ? `No snippets found${search ? ` matching "${search}"` : ''}` : 'No snippets yet.'}</Text>
                    <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>Create Custom</Button>
                  </Stack>
                </Center>
              )}
            </ScrollArea>
          </Box>
        </Group>
        )}
      </Modal>
      <SnippetFormModal
        snippet={editing === 'new' ? null : editing}
        opened={editing !== null}
        defaultKind={kind}
        defaultCategory={tab === ALL ? undefined : tab}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function SnippetCard({ snippet, isSelected, onToggle, onEdit, onDelete }: {
  snippet: Snippet; isSelected: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const value = snippet.layers?.map((l) => l.text).join(' · ') || snippet.text;
  return (
    <Paper
      p="sm"
      withBorder
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
        position: 'relative',
      }}
      onClick={onToggle}
    >
      <Menu shadow="md" width={120} position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon size="xs" variant="subtle" color="gray" style={{ position: 'absolute', top: 8, right: 8 }} onClick={(e) => e.stopPropagation()} aria-label={`Options for ${snippet.name}`}>
            <IconDots size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</Menu.Item>
          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Tooltip bg="blue" color="white" label={value} multiline w={250} position="right-end" openDelay={300}>
        <Stack gap={4}>
          <Group justify="space-between" wrap="nowrap" pr={24}>
            <Text size="sm" fw={500} lineClamp={1}>{snippet.name}</Text>
            {isSelected && <Badge size="xs" color="blue">Added</Badge>}
            {snippet.layers && <Badge size="xs" variant="light" color="gray">Preset</Badge>}
          </Group>
          <Text size="xs" c="dimmed" lineClamp={2}>{value}</Text>
        </Stack>
      </Tooltip>
    </Paper>
  );
}

function SnippetFormModal({ snippet, opened, onClose, defaultKind, defaultCategory }: {
  snippet: Snippet | null; opened: boolean; onClose: () => void; defaultKind: LayerKind; defaultCategory?: string;
}) {
  const categories = useStore((s) => s.snippetCategories);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<LayerKind>(defaultKind);
  const [categoryId, setCategoryId] = useState<string>('uncategorized');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = opened ? (snippet?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (opened) {
      setName(snippet?.name ?? '');
      setText(snippet?.text ?? '');
      setKind(snippet?.kind ?? defaultKind);
      setCategoryId(snippet?.categoryId ?? defaultCategory ?? categories[0]?.id ?? 'uncategorized');
    }
  }

  const save = () => {
    if (!name.trim() || (!text.trim() && !snippet?.layers)) return;
    const st = useStore.getState();
    if (snippet) st.updateSnippet(snippet.id, { name: name.trim(), text, kind, categoryId });
    else st.addSnippet({ name: name.trim(), text, kind, categoryId, tag: '', weight: 1 });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={snippet ? 'Edit Snippet' : 'Create Snippet'} centered zIndex={350}>
      <Stack gap="sm">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        {!snippet?.layers && <Textarea label="Value" value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={3} maxRows={8} />}
        <Group grow>
          <Select label="Category" value={categoryId} onChange={(v) => v && setCategoryId(v)} data={categories.map((c) => ({ value: c.id, label: c.name }))} comboboxProps={{ withinPortal: true, zIndex: 400 }} />
          <Select label="Type" value={kind} onChange={(v) => v && setKind(v as LayerKind)} data={[{ value: 'positive', label: 'Positive' }, { value: 'negative', label: 'Negative' }]} comboboxProps={{ withinPortal: true, zIndex: 400 }} />
        </Group>
        <Group justify="flex-end" gap="xs" mt="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={onClose}>Cancel</Button>
          <Button size="xs" onClick={save} disabled={!name.trim()}>{snippet ? 'Save' : 'Create'}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
