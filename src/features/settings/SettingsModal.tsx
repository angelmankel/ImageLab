import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Modal, Box, Stack, Group, Text, Title, TextInput, CloseButton, NavLink, ScrollArea,
  Highlight, UnstyledButton, ActionIcon,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconSearch, IconServer, IconSparkles, IconKey, IconPhoto, IconPalette, IconVolume,
  IconChevronRight, IconChevronLeft,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import { ServersTab } from './ServersTab';
import { VeniceTab } from './VeniceTab';
import { CivitaiTab } from './CivitaiTab';
import { PreviewsTab } from './PreviewsTab';
import { ThemeTab } from './ThemeTab';
import { SoundsTab } from './SoundsTab';

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

/* ────────────────────────────────────────────────────────────────────────
   Category registry — single source of truth. Add a new pane by appending
   one entry here, plus its searchable settings below. Tab components are
   self-contained — they read what they need from the store and never touch
   the shell.
   ──────────────────────────────────────────────────────────────────────── */

type CategoryDef = {
  id: string;
  label: string;
  description: string;
  Icon: TablerIcon;
  Component: ComponentType;
};

const SETTINGS_CATEGORIES: CategoryDef[] = [
  { id: 'servers',    label: 'Servers',     description: 'ComfyUI endpoints and routing',          Icon: IconServer,   Component: ServersTab },
  { id: 'ai',         label: 'AI / Venice', description: 'Prompt helpers and image-to-prompt',     Icon: IconSparkles, Component: VeniceTab },
  { id: 'civitai',    label: 'CivitAI',     description: 'Model browser credentials',              Icon: IconKey,      Component: CivitaiTab },
  { id: 'previews',   label: 'Previews',    description: 'Model picker hover slideshow',           Icon: IconPhoto,    Component: PreviewsTab },
  { id: 'appearance', label: 'Appearance',  description: 'Theme and visual customization',         Icon: IconPalette,  Component: ThemeTab },
  { id: 'sounds',     label: 'Sounds',      description: 'Notification sounds and volume',         Icon: IconVolume,   Component: SoundsTab },
];

type SearchableSetting = {
  categoryId: string;
  settingId: string;
  label: string;
  description: string;
  keywords: string[];
};

// v1's search index: one row per setting, matched on every word of the query.
const SEARCHABLE_SETTINGS: SearchableSetting[] = [
  { categoryId: 'servers', settingId: 'servers', label: 'Active Servers', description: 'Rename, re-point, pause, or remove ComfyUI endpoints', keywords: ['server', 'comfyui', 'endpoint', 'host', 'port', 'lan', 'enable', 'disable', 'remove'] },
  { categoryId: 'servers', settingId: 'addServer', label: 'Add Server', description: 'Connect another ComfyUI endpoint', keywords: ['server', 'add', 'new', 'comfyui', 'host', 'routing', 'round-robin'] },
  { categoryId: 'ai', settingId: 'apiKey', label: 'Venice API Key', description: 'Key for the snippet library, tagging, and image-to-prompt', keywords: ['venice', 'ai', 'api', 'key', 'llm', 'token'] },
  { categoryId: 'ai', settingId: 'model', label: 'Venice Model', description: 'Chat model used by every AI helper', keywords: ['venice', 'ai', 'model', 'llm', 'llama'] },
  { categoryId: 'ai', settingId: 'promptStyle', label: 'Prompt Style', description: 'Generic SDXL phrases or Illustrious / Danbooru tags', keywords: ['prompt', 'style', 'sdxl', 'illustrious', 'danbooru', 'tag', 'brainstorm'] },
  { categoryId: 'ai', settingId: 'baseUrl', label: 'Base URL', description: 'Any OpenAI-compatible endpoint', keywords: ['base', 'url', 'endpoint', 'openai', 'provider', 'advanced'] },
  { categoryId: 'civitai', settingId: 'apiKey', label: 'CivitAI API Key', description: 'Bearer token for the model browser and metadata lookups', keywords: ['civitai', 'red', 'token', 'api', 'key', 'auth', 'browser', 'adult', 'nsfw'] },
  { categoryId: 'previews', settingId: 'previewSource', label: 'Preview Order', description: 'How the model picker hover slideshow orders its images', keywords: ['preview', 'slideshow', 'civitai', 'model', 'image', 'random', 'history', 'popular'] },
  { categoryId: 'appearance', settingId: 'theme', label: 'Theme', description: 'Choose application color theme', keywords: ['theme', 'color', 'dark', 'appearance', 'style', 'palette'] },
  { categoryId: 'appearance', settingId: 'customTheme', label: 'Custom Theme', description: 'Create and manage custom color themes', keywords: ['custom', 'theme', 'color', 'create', 'picker'] },
  { categoryId: 'appearance', settingId: 'iconStyle', label: 'Icon Style', description: 'Stroke weight of the interface icons', keywords: ['icon', 'weight', 'thin', 'bold', 'solid', 'outline', 'fill'] },
  { categoryId: 'appearance', settingId: 'gradientStyle', label: 'Background Style', description: 'Choose background gradient style for the main content area', keywords: ['background', 'gradient', 'flat', 'radial', 'mesh', 'glow', 'style'] },
  { categoryId: 'appearance', settingId: 'borderRadius', label: 'Border Radius', description: 'Control the roundness of corners throughout the interface', keywords: ['border', 'radius', 'corners', 'rounded', 'sharp', 'pill'] },
  { categoryId: 'appearance', settingId: 'shadows', label: 'Shadows', description: 'Adjust shadow depth for cards and panels', keywords: ['shadow', 'depth', 'elevation', 'flat', 'dramatic'] },
  { categoryId: 'appearance', settingId: 'borders', label: 'Borders', description: 'Control the visibility and weight of borders between UI sections', keywords: ['border', 'line', 'separator', 'divider', 'outline'] },
  { categoryId: 'sounds', settingId: 'volume', label: 'Sound Volume', description: 'Notification sounds for job submission and completion', keywords: ['sound', 'audio', 'volume', 'chime', 'mute', 'notification'] },
];

const categoryById = (id: string) => SETTINGS_CATEGORIES.find(c => c.id === id) ?? SETTINGS_CATEGORIES[0];

/**
 * Settings — v1's settings page (category sidebar with search, a titled pane of section
 * cards) inside a large centred modal. Only the content pane scrolls; the chrome stays put.
 *
 * Phones (under 48em) get the whole screen and two levels instead of two columns: the search box
 * and the category list first, then one category at full width with a Back button in the header.
 */
export function SettingsModal({ open, onOpenChange }: Props) {
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const [activeId, setActiveId] = useState<string>(SETTINGS_CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  /** Phones only: showing one category (true) or the category list (false). */
  const [phoneDetail, setPhoneDetail] = useState(false);

  // Reset to a clean state every time the modal is reopened so users don't
  // land on a stale section (or a search query from last time).
  useEffect(() => {
    if (open) { setActiveId(SETTINGS_CATEGORIES[0].id); setQuery(''); setPhoneDetail(false); }
  }, [open]);

  const isSearching = query.trim().length > 0;
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return SEARCHABLE_SETTINGS.filter(s => {
      const category = categoryById(s.categoryId);
      const text = [s.label, s.description, category.label, ...s.keywords].join(' ').toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }, [query]);
  const highlighted = useMemo(() => new Set(results.map(r => r.categoryId)), [results]);

  // Like v1: while searching, move the sidebar selection onto the first matching category.
  useEffect(() => {
    if (results.length > 0 && !highlighted.has(activeId)) setActiveId(results[0].categoryId);
  }, [results, highlighted, activeId]);

  const openCategory = (id: string) => { setActiveId(id); setQuery(''); setPhoneDetail(true); };
  const active = categoryById(activeId);
  const ActiveComponent = active.Component;
  // Phones show one of the two columns: the list (with search results) or one category.
  const showSidebar = !narrow || !phoneDetail;
  const showContent = !narrow || phoneDetail;

  const title = narrow && phoneDetail ? (
    <Group gap={6} wrap="nowrap">
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setPhoneDetail(false)} aria-label="Back to all settings">
        <IconChevronLeft size={20} />
      </ActionIcon>
      <span>{active.label}</span>
    </Group>
  ) : 'Settings';

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title={title}
      centered
      fullScreen={narrow}
      size="80vw"
      padding={0}
      closeButtonProps={{ 'aria-label': 'Close', size: narrow ? 'lg' : 'md' }}
      overlayProps={{ backgroundOpacity: 0.7, blur: 3 }}
      transitionProps={narrow ? { transition: 'fade', duration: 120 } : undefined}
      styles={{
        content: {
          height: narrow ? '100dvh' : '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-dark-7)',
        },
        header: {
          paddingInline: narrow ? 'var(--mantine-spacing-sm)' : 'var(--mantine-spacing-lg)',
          paddingTop: narrow ? 'calc(env(safe-area-inset-top, 0px) + var(--mantine-spacing-xs))' : undefined,
          minHeight: narrow ? 56 : undefined,
          borderBottom: narrow ? '1px solid var(--mantine-color-dark-4)' : undefined,
        },
        title: { fontWeight: 600, fontSize: narrow ? 'var(--mantine-font-size-lg)' : undefined, minWidth: 0 },
        body: { flex: 1, minHeight: 0, display: 'flex', padding: 0, paddingBottom: narrow ? 'env(safe-area-inset-bottom, 0px)' : 0 },
      }}
    >
      <Group gap={0} align="stretch" wrap="nowrap" style={{ flex: 1, minHeight: 0, width: '100%' }}>
        {/* Sidebar — search + categories (the whole screen on a phone's first level) */}
        {showSidebar && <Box
          p="md"
          style={{
            width: narrow ? '100%' : 240,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mantine-spacing-md)',
            backgroundColor: narrow ? undefined : 'var(--mantine-color-dark-6)',
            borderRight: narrow ? undefined : '1px solid var(--mantine-color-dark-4)',
          }}
        >
          <TextInput
            placeholder="Search settings..."
            aria-label="Search settings"
            size={narrow ? 'md' : 'sm'}
            leftSection={<IconSearch size={16} />}
            rightSection={query ? <CloseButton size="sm" onClick={() => setQuery('')} aria-label="Clear search" /> : null}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            // A phone's keyboard would cover half the list the moment Settings opens.
            data-autofocus={narrow ? undefined : true}
          />
          <ScrollArea scrollbars="y" style={{ flex: 1, minHeight: 0 }} type="auto" offsetScrollbars>
            {narrow && isSearching ? <SearchResults results={results} query={query} onOpen={openCategory} /> : <>
            <Text size="xs" fw={600} c="dimmed" mb="sm" tt="uppercase">Categories</Text>
            <Stack gap={4} role="tablist" aria-orientation="vertical">
              {SETTINGS_CATEGORIES.map(c => {
                const isActive = c.id === active.id;
                const isHit = isSearching && highlighted.has(c.id);
                return (
                  <NavLink
                    key={c.id}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    label={c.label}
                    description={c.description}
                    leftSection={<c.Icon size={18} />}
                    rightSection={narrow ? <IconChevronRight size={16} style={{ opacity: 0.5 }} /> : undefined}
                    py={narrow ? 'sm' : undefined}
                    active={isActive && !narrow}
                    variant="filled"
                    onClick={() => openCategory(c.id)}
                    style={{
                      borderRadius: 'var(--mantine-radius-sm)',
                      ...(isHit && !isActive
                        ? { backgroundColor: 'var(--mantine-color-dark-5)', borderLeft: '2px solid var(--mantine-primary-color-filled)' }
                        : {}),
                    }}
                    styles={{ description: { fontSize: 'var(--mantine-font-size-xs)' } }}
                  />
                );
              })}
            </Stack>
            </>}
          </ScrollArea>
        </Box>}

        {/* Content pane — keyed so each category (or the results list) opens scrolled to the top. */}
        {showContent && <ScrollArea scrollbars="y" key={isSearching ? 'search' : active.id} style={{ flex: 1, minWidth: 0 }} type="auto">
          <Box p={narrow ? 'sm' : 'lg'}>
            {isSearching && !narrow ? (
              <SearchResults results={results} query={query} onOpen={openCategory} />
            ) : (
              <>
                {narrow
                  ? <Text size="sm" c="dimmed" mb="sm" px={4}>{active.description}</Text>
                  : <Box mb="lg">
                    <Title order={2} size="h3">{active.label}</Title>
                    <Text size="sm" c="dimmed" mt={4}>{active.description}</Text>
                  </Box>}
                <ActiveComponent />
              </>
            )}
          </Box>
        </ScrollArea>}
      </Group>
    </Modal>
  );
}

/** v1's search results list. Each row opens its category (v1's rows were inert). */
function SearchResults({ results, query, onOpen }: {
  results: SearchableSetting[];
  query: string;
  onOpen: (categoryId: string) => void;
}) {
  if (results.length === 0) {
    return (
      <Box ta="center" py="xl">
        <Text c="dimmed">No settings found for "{query}"</Text>
      </Box>
    );
  }
  const terms = query.trim().split(/\s+/);
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Found {results.length} setting{results.length !== 1 ? 's' : ''}
      </Text>
      {results.map(r => (
        <UnstyledButton
          key={`${r.categoryId}-${r.settingId}`}
          onClick={() => onOpen(r.categoryId)}
          p="md"
          style={{
            borderRadius: 'var(--mantine-radius-sm)',
            border: '1px solid var(--mantine-color-dark-4)',
            backgroundColor: 'var(--mantine-color-dark-6)',
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Highlight highlight={terms} size="sm" fw={500}>{r.label}</Highlight>
              <Highlight highlight={terms} size="xs" c="dimmed">{r.description}</Highlight>
              <Text size="xs" c="dimmed" mt={4}>Category: {categoryById(r.categoryId).label}</Text>
            </div>
            <IconChevronRight size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}
