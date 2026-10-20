/**
 * The row of tools over the Video panel's prompt boxes, the same five as the image Prompt box:
 * presets (book), prompts from CivitAI for the installed video models (picture search), the AI
 * generator (sparkles), save to the snippet library, clear. The negative box gets the book and
 * clear. Each tool writes into the video store, with Undo on a replace.
 */
import { useState } from 'react';
import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBooks, IconDeviceFloppy, IconPhotoSearch, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { DEFAULT_CATEGORY_ID } from '@/lib/storage';
import type { LayerKind } from '@/lib/types';
import { PresetLibraryModal } from '@/features/layers/PresetLibraryModal';
import { CivitaiPromptsModal } from '@/features/layers/CivitaiPromptsModal';
import { PromptGeneratorButton } from '@/features/layers/PromptGeneratorButton';
import { useVideo } from './videoStore';

/** Replace the video prompt (and negative) with Undo, like the image presets do. */
export function applyToVideo(changes: Partial<Record<LayerKind, string>>, name: string) {
  const v = useVideo.getState();
  const before = { positive: v.positive, negative: v.negative };
  v.set({ ...(changes.positive != null ? { positive: changes.positive } : {}), ...(changes.negative != null ? { negative: changes.negative } : {}) });
  const id = `video-preset-${Date.now()}`;
  notifications.show({
    id, color: 'teal', autoClose: 6000, title: `Used “${name}”`,
    message: <Button size="compact-xs" variant="light" mt={4} onClick={() => { useVideo.getState().set(before); notifications.hide(id); }}>Undo</Button>,
  });
}

export function VideoPromptTools({ kind }: { kind: LayerKind }) {
  const positive = kind === 'positive';
  const text = useVideo((s) => (positive ? s.positive : s.negative));
  const engine = useVideo((s) => s.engine);
  const set = useVideo((s) => s.set);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [civitaiOpen, setCivitaiOpen] = useState(false);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    const st = useStore.getState();
    if (st.snippets.some((s) => s.text.trim() === t && s.kind === kind)) {
      notifications.show({ title: 'Already saved', message: 'This prompt is already in your library', color: 'yellow' });
      return;
    }
    const words = t.split(/\s+/);
    st.addSnippet({ name: `video: ${words.slice(0, 5).join(' ')}${words.length > 5 ? '…' : ''}`, text: t, kind, tag: 'video', weight: 1, categoryId: DEFAULT_CATEGORY_ID });
    notifications.show({ title: 'Prompt saved', message: 'Video prompt added to your library', color: 'green' });
  };

  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" fw={500}>{positive ? 'Prompt' : 'Negative prompt'}</Text>
      <Group gap="xs" wrap="nowrap">
        <Tooltip label={positive ? 'Use a preset prompt' : 'Use a preset negative'}>
          <ActionIcon size="sm" variant="subtle" onClick={() => setPresetsOpen(true)} aria-label={positive ? 'Prompt presets' : 'Negative presets'}><IconBooks size="1rem" /></ActionIcon>
        </Tooltip>
        {positive && (
          <Tooltip label="Browse prompts people used with your video models (CivitAI)">
            <ActionIcon size="sm" variant="subtle" onClick={() => setCivitaiOpen(true)} aria-label="Prompts from CivitAI"><IconPhotoSearch size="1rem" /></ActionIcon>
          </Tooltip>
        )}
        {positive && (
          <PromptGeneratorButton variant="icon" target={{ kind: 'video', engine: engine === 'h3' ? 'h3' : 'wan', current: text, apply: (t) => applyToVideo({ positive: t }, 'AI video prompt') }} />
        )}
        {positive && (
          <Tooltip label="Save to library">
            <ActionIcon size="sm" variant="subtle" onClick={save} disabled={!text.trim()} aria-label="Save video prompt to library"><IconDeviceFloppy size="1rem" /></ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Clear">
          <ActionIcon size="sm" variant="subtle" onClick={() => set(positive ? { positive: '' } : { negative: '' })} disabled={!text.trim()} aria-label={positive ? 'Clear prompt' : 'Clear negative prompt'}><IconX size="1rem" /></ActionIcon>
        </Tooltip>
      </Group>
      <PresetLibraryModal opened={presetsOpen} onClose={() => setPresetsOpen(false)} kind={kind} onApply={applyToVideo} initialFamily="none" />
      {positive && <CivitaiPromptsModal opened={civitaiOpen} onClose={() => setCivitaiOpen(false)} only="video"
        onUse={(p) => applyToVideo(engine === 'h3' || !p.negative ? { positive: p.positive } : { positive: p.positive, negative: p.negative }, 'a CivitAI video prompt')} />}
    </Group>
  );
}
