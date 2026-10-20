/**
 * The prompt hub's Mine: the user's own saved whole prompts of this kind (`mineStore`), newest
 * first, with a search box; tap = use, the × deletes with Undo. "Make a set" asks the AI for N
 * prompts on a theme and saves them all. Under them, the built-in starters (`lib/promptLibrary`,
 * image only) for a quick first try.
 */
import { useMemo, useRef, useState } from 'react';
import { ActionIcon, Button, Collapse, Group, Loader, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconChevronRight, IconSearch, IconSparkles, IconX } from '@tabler/icons-react';
import * as Popover from '@/components/ui/popover';
import { Segmented } from '@/components/blocks/Segmented';
import { useStore } from '@/lib/store';
import { profileById } from '@/lib/modelProfiles';
import { PROMPT_PRESETS, familyForCheckpoint, presetPrompt } from '@/lib/promptLibrary';
import { filterMine, parsePromptSet, type MinePrompt, type PromptKind } from '@/lib/promptMine';
import { aiNotReadyHint, aiReady, generatePromptSet } from '@/lib/venice';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { useVideo } from '@/features/video/videoStore';
import { useMine } from './mineStore';
import { promptKindOf, usePrompt, type HubKind } from './PromptHub';

export function MinePrompts({ kind: hub, large }: { kind: HubKind; large: boolean }) {
  const kind = promptKindOf(hub);
  const items = useMine(s => s.items);
  const remove = useMine(s => s.remove);
  const restore = useMine(s => s.restore);
  const [query, setQuery] = useState('');
  const [startersOpen, setStartersOpen] = useState(false);
  const apply = usePrompt(hub);
  const mine = useMemo(() => filterMine(items, kind, query), [items, kind, query]);

  const del = (p: MinePrompt) => {
    remove(p.id);
    const id = `mine-del-${p.id}`;
    notifications.show({ id, title: 'Removed from Mine', message: <Button size="compact-xs" variant="light" mt={4} onClick={() => { restore(p); notifications.hide(id); }}>Undo</Button>, autoClose: 6000 });
  };

  return (
    <div className="flex flex-col gap-2">
      <Group gap={6} wrap="nowrap">
        <TextInput size={large ? 'md' : 'xs'} placeholder="Search my prompts" leftSection={<IconSearch size={14} />} value={query} onChange={e => setQuery(e.currentTarget.value)} style={{ flex: 1 }} aria-label="Search my prompts" />
        <MakeSet kind={kind} large={large} />
      </Group>
      {mine.length === 0 && (
        <Text size="xs" c="dimmed" px={4} py="sm" ta="center">
          {query ? 'Nothing matches.' : `Nothing saved yet. "Save to Mine" under the prompt, or make a set.`}
        </Text>
      )}
      <div className="flex flex-col gap-1.5">
        {mine.map(p => (
          <div key={p.id} className="flex items-start gap-1 rounded-lg border border-border-default bg-bg-elev">
            <UnstyledButton onClick={() => apply({ positive: p.positive, negative: p.negative }, p.name)} className="min-w-0 flex-1 px-2.5 py-2 text-left" title={p.positive}>
              <Text size="sm" fw={500} truncate>{p.name}{p.theme && <Text span size="xs" c="dimmed"> · {p.theme}</Text>}</Text>
              <Text size="xs" c="dimmed" lineClamp={2}>{p.positive}</Text>
            </UnstyledButton>
            <Tooltip label="Remove"><ActionIcon variant="subtle" color="gray" size={large ? 'lg' : 'md'} mt={4} mr={4} onClick={() => del(p)} aria-label={`Remove ${p.name}`}><IconX size={14} /></ActionIcon></Tooltip>
          </div>
        ))}
      </div>
      {kind === 'image' && <Starters hub={hub} open={startersOpen} onToggle={() => setStartersOpen(v => !v)} query={query} />}
    </div>
  );
}

/** The built-in presets, with the model family's quality tags in front. */
function Starters({ hub, open, onToggle, query }: { hub: HubKind; open: boolean; onToggle: () => void; query: string }) {
  const checkpoint = useStore(s => s.workflow.checkpoints[0]?.name);
  const typeHasTags = useStore(s => !!profileById(s.workflow.modelProfile)?.tags.length);
  const apply = usePrompt(hub);
  const fam = familyForCheckpoint(checkpoint, typeHasTags);
  const q = query.trim().toLowerCase();
  const visible = PROMPT_PRESETS.filter(p => !q || `${p.name} ${p.category} ${p.positive}`.toLowerCase().includes(q));
  const shown = open || q;
  return (
    <div className="flex flex-col gap-1.5">
      <UnstyledButton onClick={onToggle} aria-expanded={!!shown} className="flex min-h-9 items-center gap-1.5 rounded-md px-1 hover:bg-bg-elev">
        {shown ? <IconChevronDown size={14} className="opacity-60" /> : <IconChevronRight size={14} className="opacity-60" />}
        <Text size="sm" fw={500}>Starters</Text>
        <Text size="xs" c="dimmed">{visible.length} built in</Text>
      </UnstyledButton>
      <Collapse in={!!shown}>
        <div className="flex flex-col gap-1.5">
          {visible.map(p => (
            <UnstyledButton key={p.id} onClick={() => { const t = presetPrompt(p, fam); apply({ positive: t.positive, negative: t.negative }, p.name); }}
              className="rounded-lg border border-border-default bg-bg-elev px-2.5 py-2 text-left hover:border-border-strong" title={p.positive}>
              <Text size="sm" fw={500} truncate>{p.name} <Text span size="xs" c="dimmed">· {p.category}</Text></Text>
              <Text size="xs" c="dimmed" lineClamp={2}>{p.positive}</Text>
            </UnstyledButton>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

const COUNTS = [{ value: '4', label: '4' }, { value: '6', label: '6' }, { value: '8', label: '8' }];

/** "✨ Make a set": a theme, a count, and N prompts land in Mine. */
function MakeSet({ kind, large }: { kind: PromptKind; large: boolean }) {
  const venice = useStore(s => s.venice);
  const engine = useVideo(s => s.engine);
  const save = useMine(s => s.save);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState('6');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const ready = aiReady(venice);

  const make = async () => {
    if (!theme.trim() || busy) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    try {
      const raw = await generatePromptSet({ theme, kind, count: Number(count), engine: engine === 'h3' ? 'h3' : 'wan', settings: venice, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      const prompts = parsePromptSet(raw);
      let n = 0;
      for (const positive of prompts) if (save({ kind, positive, theme: theme.trim() })) n++;
      notifications.show(n ? { title: `${n} prompt${n === 1 ? '' : 's'} saved to Mine`, message: theme.trim(), color: 'green' } : { title: 'Nothing usable came back', message: 'Try another theme.', color: 'yellow' });
      if (n) { setOpen(false); setTheme(''); }
    } catch (e) {
      if (!ctrl.signal.aborted) notifications.show({ title: 'Could not make the set', message: e instanceof Error ? e.message : String(e), color: 'red' });
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  return (
    <Popover.Root open={open} onOpenChange={o => { setOpen(o); if (!o) abort.current?.abort(); }}>
      <Popover.Trigger asChild>
        <Button size={large ? 'md' : 'xs'} variant="light" color="violet" leftSection={<IconSparkles size={14} />} disabled={!ready} title={ready ? 'Ask the AI for a set of prompts on a theme' : `${aiNotReadyHint(venice)} to make a set`} className="shrink-0">
          Make a set
        </Button>
      </Popover.Trigger>
      <Popover.Content side="bottom" align="end" className="flex w-[320px] flex-col gap-2 rounded-xl border border-border-default bg-bg-elev p-3 shadow-2xl">
        <Text size="sm" fw={600}>Make a set of {kind} prompts</Text>
        <TextInput size="sm" value={theme} onChange={e => setTheme(e.currentTarget.value)} placeholder={kind === 'video' ? 'a theme: rainy city at night, cats…' : 'a theme: moody portraits, sci-fi cities…'}
          onKeyDown={e => { if (e.key === 'Enter') void make(); }} data-autofocus aria-label="Theme" />
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Text size="xs" c="dimmed">How many</Text>
          <Segmented ariaLabel="How many prompts" size="xs" fullWidth={false} value={count} onChange={setCount} options={COUNTS} />
        </Group>
        <AiModelPicker size="xs" />
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="default" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button size="xs" color="violet" onClick={() => void make()} disabled={busy || !theme.trim()} leftSection={busy ? <Loader size={12} color="white" /> : <IconSparkles size={13} />}>{busy ? 'Writing…' : 'Make'}</Button>
        </Group>
      </Popover.Content>
    </Popover.Root>
  );
}
