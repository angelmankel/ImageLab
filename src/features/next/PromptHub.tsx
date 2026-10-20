/**
 * The prompt hub: the one place a prompt comes from, in the Image and the Video step alike
 * (`kind`), and the Workflow step's shared prompt. Three tabs:
 *
 *   Write   — the prompt box (image: the positive layers' main part with the snippet chips and
 *             the parts under it, the negative folded away; video: the motion prompt) and the
 *             AI pens: "Write it" (from an idea or the current prompt), "Improve", "From the
 *             picture" (the input image / start frame, through the vision model), "Save to Mine".
 *   Library — pictures from CivitAI for the installed models, each with its prompt: tap one and
 *             its prompt is in the box (video: rewritten as a motion prompt); "As input" makes it
 *             the input image / start frame.
 *   Mine    — the user's own saved prompts and the built-in starters; "Make a set" asks the AI
 *             for N prompts on a theme and keeps them here.
 *
 * Every replace offers Undo (the image presets' `applyWithUndo`, the video's `applyToVideo`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Collapse, Group, Loader, Text, Textarea, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBookmark, IconBooks, IconChevronDown, IconChevronRight, IconDeviceFloppy, IconPencil, IconPhotoSearch, IconPhotoUp, IconWand, IconX } from '@tabler/icons-react';
import { Segmented } from '@/components/blocks/Segmented';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { aiNotReadyHint, aiReady, expandPromptFragment, generateVideoPrompt, promptFromImage, videoPromptFromImage } from '@/lib/ai';
import type { PromptKind } from '@/lib/promptMine';
import { PromptBox, SnippetsRow } from '@/features/layers/PromptFields';
import { SnippetChips } from '@/features/layers/SnippetChips';
import { PromptGeneratorButton } from '@/features/layers/PromptGeneratorButton';
import { applyWithUndo } from '@/features/layers/PresetLibraryModal';
import { applyToVideo } from '@/features/video/VideoPromptTools';
import { useVideo } from '@/features/video/videoStore';
import { PromptPanel } from '@/features/studio/StudioPanels';
import { useStudio } from '@/features/studio/studioStore';
import { inputViewUrl } from '@/features/studio/ImageInput';
import { useModeHost } from '@/features/workspace/modeHost';
import { CivitaiLibrary } from './CivitaiLibrary';
import { MinePrompts } from './MinePrompts';
import { useMine } from './mineStore';
import { useNext, type HubTab } from './nextStore';

const TABS: { value: HubTab; label: string; icon: ReactNode }[] = [
  { value: 'write', label: 'Write', icon: <IconPencil size={15} /> },
  { value: 'library', label: 'Library', icon: <IconPhotoSearch size={15} /> },
  { value: 'mine', label: 'Mine', icon: <IconBookmark size={15} /> },
];

/** Which step the hub serves. Workflow borrows the image Library and Mine, writing its shared prompt. */
export type HubKind = 'image' | 'video' | 'workflow';
/** The saved-prompt kind a hub kind reads and writes. */
export const promptKindOf = (kind: HubKind): PromptKind => (kind === 'video' ? 'video' : 'image');

/** Replace the Workflow step's prompt (the shared one, or the workflow's own) with Undo. */
function applyToWorkflow(text: string, name: string) {
  const st = useStudio.getState();
  const before = st.path && st.useShared[st.path] === false ? st.ownPrompt[st.path] ?? '' : st.sharedPrompt;
  st.setPrompt(text);
  const id = `wf-prompt-${Date.now()}`;
  notifications.show({
    id, color: 'teal', autoClose: 6000, title: `Used “${name}”`,
    message: <Button size="compact-xs" variant="light" mt={4} onClick={() => { useStudio.getState().setPrompt(before); notifications.hide(id); }}>Undo</Button>,
  });
}

/** The current prompt of a kind, as text: the image's compiled positive, the video prompt, or the workflow's. */
export function useCurrentPrompt(kind: HubKind): { positive: string; negative: string } {
  const layers = useStore(s => s.layers);
  const vPos = useVideo(s => s.positive);
  const vNeg = useVideo(s => s.negative);
  const wf = useStudio(s => (s.path && s.useShared[s.path] === false ? s.ownPrompt[s.path] ?? '' : s.sharedPrompt));
  if (kind === 'video') return { positive: vPos, negative: vNeg };
  if (kind === 'workflow') return { positive: wf, negative: '' };
  const main = (k: 'positive' | 'negative') => layers.find(l => l.kind === k)?.text ?? '';
  return { positive: main('positive'), negative: main('negative') };
}

/** Put a whole prompt into the step's box, with Undo. */
export function usePrompt(kind: HubKind) {
  const engine = useVideo(s => s.engine);
  return (p: { positive: string; negative?: string }, name: string) => {
    if (kind === 'video') applyToVideo(engine === 'h3' || !p.negative ? { positive: p.positive } : { positive: p.positive, negative: p.negative }, name);
    else if (kind === 'workflow') applyToWorkflow(p.positive, name);
    else applyWithUndo(p.negative ? { positive: p.positive, negative: p.negative } : { positive: p.positive }, name);
  };
}

export function PromptHub({ kind, large = false }: { kind: HubKind; large?: boolean }) {
  const tab = useNext(s => s.hubTab);
  const setTab = useNext(s => s.setHubTab);
  return (
    <div className="flex flex-col gap-2.5">
      <Segmented ariaLabel="Prompt source" size={large ? 'md' : 'sm'} value={tab} onChange={setTab} options={TABS} />
      {tab === 'write' && (kind === 'video' ? <VideoWrite large={large} /> : kind === 'workflow' ? <WorkflowWrite large={large} /> : <ImageWrite large={large} />)}
      {tab === 'library' && <CivitaiLibrary kind={kind} large={large} />}
      {tab === 'mine' && <MinePrompts kind={kind} large={large} />}
    </div>
  );
}

/** A small fold: "Negative prompt", "Parts & model words". */
function Fold({ label, hint, open, onToggle, children }: { label: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <UnstyledButton onClick={onToggle} aria-expanded={open} className="flex min-h-9 items-center gap-1.5 rounded-md px-1 text-left hover:bg-bg-elev">
        {open ? <IconChevronDown size={14} className="shrink-0 opacity-60" /> : <IconChevronRight size={14} className="shrink-0 opacity-60" />}
        <Text size="sm" fw={500}>{label}</Text>
        {hint && !open && <Text size="xs" c="dimmed" truncate className="min-w-0 flex-1">{hint}</Text>}
      </UnstyledButton>
      <Collapse in={open}><div className="flex flex-col gap-2 pl-1">{children}</div></Collapse>
    </div>
  );
}

/** "Save to Mine" for the current prompt of a kind. */
function SaveToMine({ kind, positive, negative }: { kind: PromptKind; positive: string; negative?: string }) {
  const save = useMine(s => s.save);
  const onSave = () => {
    const id = save({ kind, positive, negative });
    notifications.show(id ? { title: 'Saved to Mine', message: positive.slice(0, 80), color: 'green' } : { title: 'Already in Mine', message: 'This prompt is saved already', color: 'yellow' });
  };
  return (
    <Button size="xs" variant="light" color="gray" leftSection={<IconDeviceFloppy size={14} />} onClick={onSave} disabled={!positive.trim()} className="shrink-0">Save to Mine</Button>
  );
}

/** One AI action with its busy state and Undo through `apply`. */
function AiButton({ label, icon, title, disabled, run }: { label: string; icon: ReactNode; title?: string; disabled?: boolean; run: (signal: AbortSignal) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const go = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    try { await run(ctrl.signal); }
    catch (e) { if (!ctrl.signal.aborted) notifications.show({ title: label, message: e instanceof Error ? e.message : String(e), color: 'red' }); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  };
  return (
    <Tooltip label={title} disabled={!title} withArrow>
      <Button size="xs" variant="light" color="violet" leftSection={busy ? <Loader size={12} color="violet" /> : icon} onClick={() => void go()} disabled={disabled || busy} className="shrink-0">
        {label}
      </Button>
    </Tooltip>
  );
}

// ── Image ───────────────────────────────────────────────────────────────────

function ImageWrite({ large }: { large: boolean }) {
  const { positive, negative } = useCurrentPrompt('image');
  const inputImage = useStore(s => s.workflow.inputImage);
  const ai = useStore(s => s.ai);
  const layers = useStore(s => s.layers);
  const ready = aiReady(ai);
  const hint = ready ? undefined : `${aiNotReadyHint(ai)} to use the AI pens`;
  const [negOpen, setNegOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const apply = usePrompt('image');
  const extraParts = layers.filter(l => l.kind === 'positive').length - 1;

  return (
    <div className="flex flex-col gap-3">
      <PromptBox kind="positive" hub minRows={large ? 5 : 4} />
      <SnippetChips kind="positive" large={large} />
      <div className="scroll-x-thin flex items-center gap-1.5" style={{ touchAction: 'pan-x' }}>
        <PromptGeneratorButton variant="button" label="Write it" />
        <AiButton label="Improve" icon={<IconWand size={14} />} disabled={!ready || !positive.trim()} title={hint ?? 'Rewrite the prompt richer, same idea'}
          run={async (signal) => {
            const text = await expandPromptFragment(compileLayers(useStore.getState().layers, 'positive'), 'positive', 'improve', ai, signal);
            if (!signal.aborted && text.trim()) apply({ positive: text.trim() }, 'Improve');
          }} />
        {inputImage && (
          <AiButton label="From the picture" icon={<IconPhotoUp size={14} />} disabled={!ready} title={hint ?? 'Describe the input image as a prompt'}
            run={async (signal) => {
              const text = await promptFromImage(inputImage.dataUrl, ai, signal);
              if (!signal.aborted && text.trim()) apply({ positive: text.trim() }, 'From the picture');
            }} />
        )}
        <SaveToMine kind="image" positive={positive} negative={negative} />
      </div>
      <Fold label="Negative prompt" hint={negative.trim() || 'nothing to avoid yet'} open={negOpen} onToggle={() => setNegOpen(v => !v)}>
        <PromptBox kind="negative" hub />
        <SnippetChips kind="negative" large={large} />
        <SnippetsRow kind="negative" compact />
      </Fold>
      <Fold label="Parts & model words" hint={extraParts > 0 ? `${extraParts} more part${extraParts === 1 ? '' : 's'}` : 'weights, trigger words, quality tags'} open={partsOpen} onToggle={() => setPartsOpen(v => !v)}>
        <SnippetsRow kind="positive" />
      </Fold>
    </div>
  );
}

// ── Video ───────────────────────────────────────────────────────────────────

/** The video prompt box: a local draft so typing never waits on the store. */
function VideoBox({ kind, large }: { kind: 'positive' | 'negative'; large: boolean }) {
  const text = useVideo(s => (kind === 'positive' ? s.positive : s.negative));
  const set = useVideo(s => s.set);
  const [draft, setDraft] = useState(text);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current === null) return;
    set(kind === 'positive' ? { positive: pending.current } : { negative: pending.current });
    pending.current = null;
  };
  useEffect(() => { if (pending.current === null) setDraft(text); }, [text]);
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const accent = kind === 'positive' ? 'teal' : 'red';
  return (
    <div className="flex flex-col gap-1">
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>{kind === 'positive' ? 'Motion prompt' : 'Negative prompt'}</Text>
        <Tooltip label="Clear">
          <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconX size={12} />} disabled={!draft.trim()}
            onClick={() => { pending.current = null; setDraft(''); set(kind === 'positive' ? { positive: '' } : { negative: '' }); }}>Clear</Button>
        </Tooltip>
      </Group>
      <Textarea
        value={draft}
        onChange={e => { const v = e.currentTarget.value; setDraft(v); pending.current = v; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(flush, 250); }}
        onBlur={flush}
        autosize minRows={kind === 'positive' ? (large ? 5 : 4) : 2} maxRows={14}
        placeholder={kind === 'positive' ? 'What happens in the clip: the scene, the motion, the camera…' : 'What to avoid…'}
        aria-label={kind === 'positive' ? 'Video prompt' : 'Video negative prompt'}
        styles={{ input: { borderLeft: `3px solid var(--mantine-color-${accent}-6)`, paddingLeft: 'calc(var(--mantine-spacing-sm) + 2px)' } }}
      />
    </div>
  );
}

function VideoWrite({ large }: { large: boolean }) {
  const { positive, negative } = useCurrentPrompt('video');
  const engine = useVideo(s => s.engine);
  const startImage = useVideo(s => s.startImage);
  const mode = useVideo(s => s.mode);
  const h3Mode = useVideo(s => s.h3.mode);
  const host = useModeHost('video');
  const ai = useStore(s => s.ai);
  const ready = aiReady(ai);
  const hint = ready ? undefined : `${aiNotReadyHint(ai)} to use the AI pens`;
  const [negOpen, setNegOpen] = useState(false);
  const apply = usePrompt('video');
  const eng = engine === 'h3' ? 'h3' : 'wan';
  const hasFrame = !!startImage && (engine === 'h3' ? h3Mode !== 't2v' : mode === 'i2v');
  const frameUrl = host ? inputViewUrl(host, startImage) : null;

  return (
    <div className="flex flex-col gap-3">
      <VideoBox kind="positive" large={large} />
      <div className="scroll-x-thin flex items-center gap-1.5" style={{ touchAction: 'pan-x' }}>
        <PromptGeneratorButton variant="button" label="Write it" target={{ kind: 'video', engine: eng, current: positive, apply: (t) => apply({ positive: t }, 'AI video prompt') }} />
        {hasFrame && frameUrl && (
          <AiButton label="From the frame" icon={<IconPhotoUp size={14} />} disabled={!ready} title={hint ?? 'Write the motion from the start frame (vision model)'}
            run={async (signal) => {
              const text = await videoPromptFromImage(frameUrl, eng, ai, signal, positive);
              if (!signal.aborted && text.trim()) apply({ positive: text.trim() }, 'From the frame');
            }} />
        )}
        <AiButton label="Improve" icon={<IconWand size={14} />} disabled={!ready || !positive.trim()} title={hint ?? 'Rewrite it as a sharper motion prompt'}
          run={async (signal) => {
            const text = await generateVideoPrompt({ seed: positive, source: 'prompt', engine: eng, settings: ai, signal });
            if (!signal.aborted && text.trim()) apply({ positive: text.trim() }, 'Improve');
          }} />
        <SaveToMine kind="video" positive={positive} negative={engine === 'h3' ? undefined : negative} />
      </div>
      {engine !== 'h3' && (
        <Fold label="Negative prompt" hint={negative.trim().slice(0, 60) || 'nothing to avoid yet'} open={negOpen} onToggle={() => setNegOpen(v => !v)}>
          <VideoBox kind="negative" large={large} />
        </Fold>
      )}
      <Text size="xs" c="dimmed" className="flex items-center gap-1"><IconBooks size={12} /> Library and Mine put a prompt straight in here.</Text>
    </div>
  );
}

// ── Workflow ────────────────────────────────────────────────────────────────

/** The Workflow step's prompt: keywords for this workflow, the shared prompt, where it is sent. */
function WorkflowWrite({ large }: { large: boolean }) {
  const { positive } = useCurrentPrompt('workflow');
  const path = useStudio(s => s.path);
  const targetId = useStudio(s => s.targetId());
  const ai = useStore(s => s.ai);
  const ready = aiReady(ai);
  const hint = ready ? undefined : `${aiNotReadyHint(ai)} to use the AI pens`;
  const apply = usePrompt('workflow');
  if (!path) return <Text size="xs" c="dimmed" px={4} py="sm" ta="center">Pick a workflow first.</Text>;
  if (!targetId) return <Text size="xs" c="dimmed" px={4} py="sm" ta="center">This workflow has no text box to write a prompt into.</Text>;
  return (
    <div className="flex flex-col gap-3">
      <PromptPanel large={large} />
      <div className="scroll-x-thin flex items-center gap-1.5" style={{ touchAction: 'pan-x' }}>
        <PromptGeneratorButton variant="button" label="Write it" target={{ kind: 'text', current: positive, apply: (t) => apply({ positive: t }, 'AI prompt') }} />
        <AiButton label="Improve" icon={<IconWand size={14} />} disabled={!ready || !positive.trim()} title={hint ?? 'Rewrite the prompt richer, same idea'}
          run={async (signal) => {
            const text = await expandPromptFragment(positive, 'positive', 'improve', ai, signal);
            if (!signal.aborted && text.trim()) apply({ positive: text.trim() }, 'Improve');
          }} />
        <SaveToMine kind="image" positive={positive} />
      </div>
    </div>
  );
}
