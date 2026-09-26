/**
 * Quick search ("spotlight"): Ctrl/Cmd+K, or the search button in the nav rail / phone header.
 * One box that finds and runs anything — go to a view or a panel section, run an action, pick a
 * checkpoint, add or remove a LoRA or embedding, insert a snippet, use a prompt preset.
 *
 * Items are built when the window opens, from the stores as they are then; ranking lives in
 * `lib/spotlight.ts`. A picked item closes the window first, then runs, so whatever it opens
 * gets the focus.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Box, Group, Kbd, Modal, ScrollArea, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBolt, IconBook, IconBookmarks, IconBox, IconCompass, IconLayoutSidebar, IconPuzzle, IconSearch, IconSparkles,
} from '@tabler/icons-react';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { rankSpotlight, type SpotlightItem } from '@/lib/spotlight';
import { emitApp, onApp } from '@/lib/appEvents';
import { useStore } from '@/lib/store';
import { useCanvasStore, type MainView } from '@/lib/canvasStore';
import { uid } from '@/lib/storage';
import { applyPromptPreset } from '@/lib/promptPresets';
import { PROMPT_PRESETS, familyForCheckpoint, presetPrompt } from '@/lib/promptLibrary';
import { SECTION_IDS, type SectionId } from '@/lib/panelTabs';
import { usePanelTabs } from '@/features/panel/panelTabsStore';
import { SECTION_META } from '@/features/panel/sections';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { applyWithUndo } from '@/features/layers/PresetLibraryModal';
import { useLibraryStore } from '@/features/library/store';
import { modelLabel } from '@/components/models/modelInfo';

const GROUPS = ['Go to', 'Panel', 'Actions', 'Checkpoints', 'LoRAs', 'Embeddings', 'Snippets', 'Prompt presets'];
const GROUP_ICON: Record<string, ReactNode> = {
  'Go to': <IconCompass size={14} />, Panel: <IconLayoutSidebar size={14} />, Actions: <IconBolt size={14} />,
  Checkpoints: <IconBox size={14} />, LoRAs: <IconPuzzle size={14} />, Embeddings: <IconSparkles size={14} />,
  Snippets: <IconBookmarks size={14} />, 'Prompt presets': <IconBook size={14} />,
};

/** Words each panel section should be found by, beyond its title. */
const SECTION_WORDS: Record<SectionId, string> = {
  prompts: 'prompt negative snippets trigger words text',
  models: 'checkpoint lora embedding vae model',
  parameters: 'sampler scheduler steps cfg clip skip denoise',
  composition: 'width height size resolution batch dimensions',
  enhancement: 'loopback hires fix upscale noise frame zoom rounds auto scale',
  input: 'img2img input image upload reference',
  passes: 'refine upscale resize remove background pass',
};

function useItems(open: boolean): SpotlightItem[] {
  // Rebuilt each time the window opens; while open the lists stay put under the cursor.
  const [items, setItems] = useState<SpotlightItem[]>([]);
  useEffect(() => { if (open) setItems(buildItems()); }, [open]);
  return items;
}

function buildItems(): SpotlightItem[] {
  const st = useStore.getState();
  const setMainView = useCanvasStore.getState().setMainView;
  const narrow = window.matchMedia('(max-width: 48em)').matches;
  const out: SpotlightItem[] = [];
  const go = (view: MainView) => () => setMainView(view);

  // Go to
  const views: [string, MainView, string][] = [
    ['Generate', 'generate', 'home prompt create'],
    ['Infinite canvas', 'canvas', 'layers inpaint'],
    ['Collections', 'collections', 'albums gallery'],
    ['Browse models', 'browser', 'civitai download search'],
    ['Studio', 'studio', 'workflows comfy'],
  ];
  for (const [label, view, keywords] of views) out.push({ id: `view:${view}`, group: 'Go to', label, keywords, run: go(view) });
  out.push({ id: 'view:library', group: 'Go to', label: 'My models', keywords: 'library manager downloaded list export import',
    run: () => { setMainView('browser'); useLibraryStore.getState().setBrowserMode('library'); } });
  out.push({ id: 'view:settings', group: 'Go to', label: 'Settings', keywords: 'preferences theme sounds api key', run: () => emitApp('open-settings') });

  // Panel sections
  for (const id of SECTION_IDS) {
    out.push({
      id: `section:${id}`, group: 'Panel', label: SECTION_META[id].title, description: 'Left panel', keywords: SECTION_WORDS[id],
      run: () => {
        setMainView('generate');
        if (narrow) emitApp('mobile-tab', 'parameters');
        usePanelTabs.getState().showSection(id);
      },
    });
  }

  // Actions
  const w = st.workflow;
  out.push({ id: 'act:generate', group: 'Actions', label: 'Generate', keywords: 'run queue render', run: () => { void fireFromStore(); } });
  out.push({ id: 'act:generate-new', group: 'Actions', label: 'Generate with a new seed', keywords: 'run queue random dice', run: () => { void fireFromStore(true); } });
  out.push({
    id: 'act:loopback', group: 'Actions', label: w.loopback?.enabled ? 'Turn Loopback off' : 'Turn Loopback on', keywords: 'hires fix enhance',
    run: () => { const lb = useStore.getState().workflow.loopback; if (lb) st.setWorkflow({ loopback: { ...lb, enabled: !lb.enabled } }); else emitSection('enhancement', narrow); },
  });

  // Models
  const base = w.checkpoints[0];
  for (const name of st.server.models) {
    if (name === base?.name) continue;
    out.push({
      id: `ckpt:${name}`, group: 'Checkpoints', label: modelLabel(name), description: 'Use as the checkpoint', keywords: name,
      run: () => {
        const cps = useStore.getState().workflow.checkpoints;
        useStore.getState().setWorkflow({ checkpoints: [{ ...(cps[0] ?? { id: uid(), ratio: 0.5 }), name }, ...cps.slice(1)] });
      },
    });
  }
  for (const name of st.server.loras) {
    const has = w.loras.find((l) => l.name === name);
    out.push({
      id: `lora:${name}`, group: 'LoRAs', label: modelLabel(name), description: has ? 'Remove this LoRA' : 'Add this LoRA', keywords: name,
      run: () => (has ? st.removeLora(has.id) : st.addLora(name)),
    });
  }
  for (const name of st.server.embeddings ?? []) {
    const has = (w.embeddings ?? []).find((e) => e.name === name);
    out.push({
      id: `emb:${name}`, group: 'Embeddings', label: name, description: has ? 'Remove this embedding' : 'Add this embedding', keywords: 'embedding textual inversion',
      run: () => (has ? st.removeEmbedding(has.id) : st.addEmbedding(name)),
    });
  }

  // Snippets: a single part is added to the prompt; a full preset inserts all its parts.
  for (const s of st.snippets) {
    out.push({
      id: `snip:${s.id}`, group: 'Snippets', label: s.name, description: s.layers ? 'Insert preset' : `Add to ${s.kind === 'negative' ? 'negative' : 'prompt'}: ${s.text.slice(0, 60)}`,
      keywords: `${s.text} ${s.categoryId}`,
      run: () => {
        const now = useStore.getState();
        if (s.layers) now.setPromptLayers(applyPromptPreset(now.layers, s, 'insert', uid));
        else now.insertSnippetAsLayer(s.id);
      },
    });
  }

  // Prompt presets, with the quality tags for the current checkpoint's family.
  const family = familyForCheckpoint(base?.name);
  for (const p of PROMPT_PRESETS) {
    out.push({
      id: `preset:${p.id}`, group: 'Prompt presets', label: p.name, description: `${p.category} · replaces the prompt`, keywords: p.positive,
      run: () => { const t = presetPrompt(p, family); applyWithUndo({ positive: t.positive, negative: t.negative }, p.name); },
    });
  }
  return out;
}

function emitSection(id: SectionId, narrow: boolean) {
  useCanvasStore.getState().setMainView('generate');
  if (narrow) emitApp('mobile-tab', 'parameters');
  usePanelTabs.getState().showSection(id);
}

/** With an empty box: where to go and what to do, not every model in the library. */
const EMPTY_GROUPS = new Set(['Go to', 'Panel', 'Actions']);

export function Spotlight() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const items = useItems(open);
  const listRef = useRef<HTMLDivElement>(null);

  useShortcut('cmd+k', () => setOpen((o) => !o), { skipTyping: false, priority: ShortcutPriority.TopOverlay });
  useEffect(() => onApp('open-spotlight', () => setOpen(true)), []);
  useEffect(() => { if (!open) { setQuery(''); setIndex(0); } }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    return rankSpotlight(q ? items : items.filter((i) => EMPTY_GROUPS.has(i.group)), q, GROUPS);
  }, [items, query]);
  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (item: SpotlightItem | undefined) => {
    if (!item) return;
    setOpen(false);
    // After the modal lets go of focus, so a panel or window it opens can take it.
    setTimeout(item.run, 0);
  };

  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      withCloseButton={false}
      padding={0}
      size="lg"
      yOffset="10vh"
      fullScreen={narrow}
      zIndex={350}
      aria-label="Quick search"
      styles={{ body: { display: 'flex', flexDirection: 'column', maxHeight: narrow ? '100dvh' : '70vh', height: narrow ? '100dvh' : undefined } }}
    >
      <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search views, settings, models, snippets, presets…"
          leftSection={<IconSearch size={16} />}
          size="md"
          variant="unstyled"
          data-autofocus
          aria-label="Quick search"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); run(results[index]); }
          }}
        />
      </Box>
      <ScrollArea.Autosize mah={narrow ? undefined : '60vh'} style={narrow ? { flex: 1 } : undefined} type="auto">
        <div ref={listRef} role="listbox" aria-label="Results" style={{ padding: 6 }}>
          {results.length === 0 && <Text size="sm" c="dimmed" ta="center" py="lg">Nothing matches “{query}”.</Text>}
          {results.map((item, i) => (
            <UnstyledButton
              key={item.id}
              data-index={i}
              role="option"
              aria-selected={i === index}
              onMouseMove={() => { if (i !== index) setIndex(i); }}
              onClick={() => run(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 6,
                background: i === index ? 'var(--mantine-color-dark-5)' : undefined,
              }}
            >
              <Box c="dimmed" style={{ display: 'flex', flexShrink: 0 }}>{GROUP_ICON[item.group]}</Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" truncate>{item.label}</Text>
                {item.description && <Text size="xs" c="dimmed" truncate>{item.description}</Text>}
              </Box>
              <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>{item.group}</Badge>
            </UnstyledButton>
          ))}
        </div>
      </ScrollArea.Autosize>
      {!narrow && (
        <Group gap="md" px="sm" py={6} style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
          <Text size="xs" c="dimmed"><Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> move</Text>
          <Text size="xs" c="dimmed"><Kbd size="xs">Enter</Kbd> run</Text>
          <Text size="xs" c="dimmed"><Kbd size="xs">Esc</Kbd> close</Text>
          <Text size="xs" c="dimmed" ml="auto"><Kbd size="xs">Ctrl</Kbd>+<Kbd size="xs">K</Kbd> anywhere</Text>
        </Group>
      )}
    </Modal>
  );
}
