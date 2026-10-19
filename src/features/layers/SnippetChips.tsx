/**
 * Snippets where the prompt is: one row of chips under the text box. Tap a chip and the snippet is
 * in the prompt; tap it again and it is out. The ones already in come first, then the ones used
 * lately, so the usual picks are one tap away without a window.
 *
 * "Suggest" asks the AI helper for a few snippets that fit the current prompt and shows them as
 * chips right here; tapping one adds it to the prompt and saves it to the library, with Undo.
 * "All…" is the full library window for everything else.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Button, Loader, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBooks, IconRefresh, IconSparkles, IconX } from '@tabler/icons-react';
import { ChipButton, ChipPicker, type Chip } from '@/components/blocks';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import { compileLayers } from '@/lib/prompt';
import { applyPromptPreset } from '@/lib/promptPresets';
import { DEFAULT_CATEGORY_ID, uid } from '@/lib/storage';
import { useStore } from '@/lib/store';
import type { LayerKind, Snippet } from '@/lib/types';
import { aiNotReadyHint, aiReady, brainstormSnippets } from '@/lib/venice';
import { chipOrder } from '@/lib/workspace';
import { SnippetsModal, categoryColor } from './SnippetsModal';

/** Chips shown before "All…" takes over. */
const MAX_CHIPS = 24;

export function SnippetChips({ kind, large }: { kind: LayerKind; large?: boolean }) {
  const snippets = useStore(s => s.snippets);
  const layers = useStore(s => s.layers);
  const venice = useStore(s => s.venice);
  const recents = useWorkspace(s => s.recentSnippetIds);
  const touch = useWorkspace(s => s.touchSnippet);
  const [browsing, setBrowsing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const inPrompt = useMemo(() => new Set(layers.map(l => l.originSnippetId).filter((x): x is string => !!x)), [layers]);
  const ordered = useMemo(() => {
    const fits = snippets.filter(s => s.kind === kind || s.layers?.some(l => l.kind === kind));
    return chipOrder(fits, inPrompt, recents).slice(0, MAX_CHIPS);
  }, [snippets, kind, inPrompt, recents]);

  const toggle = (s: Snippet) => {
    const st = useStore.getState();
    touch(s.id);
    if (s.layers) { st.setPromptLayers(applyPromptPreset(st.layers, s, 'insert', uid)); return; }
    if (inPrompt.has(s.id)) st.removeLayersFromSnippet(s.id);
    else st.insertSnippetAsLayer(s.id);
  };

  const chips: Chip[] = ordered.map(s => ({
    id: s.id,
    label: s.name,
    selected: inPrompt.has(s.id),
    color: kind === 'negative' ? 'red' : categoryColor(s.categoryId),
    title: s.layers ? `Preset: ${s.layers.map(l => l.text).join(' · ')}` : s.text,
  }));

  const ready = aiReady(venice);
  return (
    <div className="flex flex-col gap-1.5">
      <ChipPicker
        items={chips}
        large={large}
        onPick={id => { const s = snippets.find(x => x.id === id); if (s) toggle(s); }}
        trailing={
          <>
            {kind === 'positive' && (
              <ChipButton
                large={large}
                onClick={() => setSuggesting(v => !v)}
                chip={{
                  id: 'suggest', label: 'Suggest', selected: suggesting, color: 'violet', disabled: !ready,
                  icon: <IconSparkles size={large ? 15 : 13} />,
                  title: ready ? 'Ask the AI for snippets that fit this prompt' : `${aiNotReadyHint(venice)} to suggest snippets`,
                }}
              />
            )}
            <ChipButton large={large} onClick={() => setBrowsing(true)}
              chip={{ id: 'all', label: 'All…', icon: <IconBooks size={large ? 15 : 13} />, title: 'The whole snippet library' }} />
          </>
        }
      />
      {suggesting && <SuggestPanel kind={kind} large={large} onClose={() => setSuggesting(false)} />}
      <SnippetsModal opened={browsing} onClose={() => setBrowsing(false)} kind={kind} />
    </div>
  );
}

/**
 * Suggestions from the AI helper, as chips. Asks straight away from the current prompt, so there
 * is nothing to type first; a hint box steers another round.
 */
function SuggestPanel({ kind, large, onClose }: { kind: LayerKind; large?: boolean; onClose: () => void }) {
  const venice = useStore(s => s.venice);
  const [hint, setHint] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [taken, setTaken] = useState<Set<string>>(() => new Set());

  const ask = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    try {
      const prompt = compileLayers(useStore.getState().layers, 'positive').slice(0, 400);
      const theme = [prompt || 'a striking portrait', hint.trim() && `Focus on: ${hint.trim()}`].filter(Boolean).join('\n');
      const got = await brainstormSnippets(theme, kind, 'Ideas that fit this prompt', venice, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setItems(got);
      setTaken(new Set());
      if (!got.length) setError('Nothing usable came back — try a hint.');
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Suggestion failed');
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  };
  // Ask on open, and cancel a request in flight when the panel goes away.
  useEffect(() => { void ask(); return () => abort.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const take = (text: string) => {
    const st = useStore.getState();
    const words = text.split(/[,\s]+/).filter(Boolean);
    const id = st.addSnippet({
      name: words.slice(0, 3).join(' '), text, kind, tag: 'AI', weight: 1, categoryId: DEFAULT_CATEGORY_ID,
    });
    st.insertSnippetAsLayer(id);
    useWorkspace.getState().touchSnippet(id);
    setTaken(prev => new Set([...prev, text]));
    const n = notifications.show({
      title: 'Snippet added',
      message: (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{text}</span>
          <Button size="compact-xs" variant="light" onClick={() => {
            const s = useStore.getState();
            s.removeLayersFromSnippet(id);
            s.removeSnippet(id);
            setTaken(prev => { const next = new Set(prev); next.delete(text); return next; });
            notifications.hide(n);
          }}>Undo</Button>
        </div>
      ),
      autoClose: 6000,
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-panel p-2">
      <div className="flex items-center gap-2">
        <IconSparkles size={14} className="shrink-0 text-violet-400" />
        <Text size="xs" fw={600} className="shrink-0">Suggestions</Text>
        {busy ? <Loader size={12} /> : <Text size="xs" c="dimmed" truncate className="min-w-0 flex-1">tap one to add it</Text>}
        <Tooltip label="Suggest again" withArrow>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => void ask()} disabled={busy} aria-label="Suggest again"><IconRefresh size={14} /></ActionIcon>
        </Tooltip>
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={onClose} aria-label="Close suggestions"><IconX size={14} /></ActionIcon>
      </div>
      {error && <Text size="xs" c="red.4">{error}</Text>}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(text => (
            <ChipButton key={text} large={large} onClick={() => { if (!taken.has(text)) take(text); }}
              chip={{ id: text, label: text, color: 'violet', selected: taken.has(text), title: text }} />
          ))}
        </div>
      )}
      <TextInput
        size={large ? 'sm' : 'xs'}
        value={hint}
        onChange={e => setHint(e.currentTarget.value)}
        onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
        placeholder="Steer it: lighting, mood, a camera…"
        aria-label="What to suggest"
        rightSection={<ActionIcon size="sm" variant="light" color="violet" onClick={() => void ask()} disabled={busy} aria-label="Suggest with this hint"><IconSparkles size={13} /></ActionIcon>}
      />
    </div>
  );
}
