/**
 * The snippet editor's "✦ From image" (its header slot, `SnippetFromImageProps` in
 * snippets/SnippetEditor.tsx): the vision model writes ONE snippet's text + name from the snippet's
 * picture, inline with a spinner. No picture yet → a small popover with the shared drop zone
 * (drop · paste · upload · library) that writes as soon as one is given. The ▾ also offers the bulk
 * window ("Several from a picture…"). Errors and "no vision model" show in the popover, no toast.
 */
import { useRef, useState } from 'react';
import { Popover } from '@mantine/core';
import { IconChevronDown, IconPhotoScan } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { aiChat, visionModelOf } from '@/lib/ai';
import { useIsPhone } from '~/app/useIsPhone';
import { ImageDropZone } from '~/compose';
import { Button, Spinner } from '~/ui';
import { T } from '~/theme/tokens';
import type { SnippetFromImageProps } from '../snippets/SnippetEditor';
import { cleanCatName, openSnippetsFromImage, shrinkForVision } from './fromImageRuns';
import { imageSnippetSystem, oneSnippetFromImageUser, parseImageSnippets } from './studioLogic';
import { useVisionNote } from './SnippetsFromImage';

export function SnippetFromImage({ image, categoryId, negative, onText }: SnippetFromImageProps) {
  const phone = useIsPhone();
  const note = useVisionNote();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const write = async (url: string) => {
    if (busy) return;
    if (note) { setError(note); setOpen(true); return; }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true); setError(null);
    try {
      const st = useStore.getState();
      const cat = st.snippetCategories.find((c) => c.id === categoryId);
      const category = cat && categoryId !== 'uncategorized' ? cleanCatName(cat.name) : undefined;
      const raw = await aiChat({
        settings: st.ai, model: visionModelOf(st.ai), signal: ctrl.signal, noThinking: true, temperature: 0.6, maxTokens: 400,
        messages: [
          { role: 'system', content: imageSnippetSystem(st.ai.promptStyle, [], false) },
          { role: 'user', content: [{ type: 'text', text: oneSnippetFromImageUser({ category, negative }) }, { type: 'image_url', image_url: { url } }] },
        ],
      });
      if (ctrl.signal.aborted) return;
      const one = parseImageSnippets(raw)[0];
      if (!one) throw new Error('The AI returned nothing usable — try again.');
      onText({ text: one.text, name: one.name });
      setOpen(false);
    } catch (e) {
      if (!ctrl.signal.aborted) { setError(e instanceof Error ? e.message : 'Failed'); setOpen(true); }
    } finally { if (!ctrl.signal.aborted) setBusy(false); }
  };

  const size = phone ? 'lg' : 'sm';
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" withinPortal zIndex={T.z.popover} trapFocus returnFocus classNames={{ dropdown: 'il-dd il-pop-in' }}>
      <Popover.Target>
        <div style={{ display: 'inline-flex', gap: 2 }}>
          <Button tone="card" size={size} style={{ color: 'var(--il-ember-hi)' }} disabled={busy}
            tooltip={image ? 'Write this snippet from its picture' : 'Write a snippet from a picture'}
            icon={busy ? <Spinner size={12} /> : undefined}
            onClick={() => { if (image) void write(image); else { setError(note); setOpen((o) => !o); } }}>
            {busy ? 'Reading…' : '✦ From image'}
          </Button>
          <Button tone="card" size={size} icon={<IconChevronDown size={13} stroke={2.6} />} tooltip="More" aria-label="More from a picture" disabled={busy}
            onClick={() => { setError(note); setOpen((o) => !o); }} />
        </div>
      </Popover.Target>
      <Popover.Dropdown style={{ width: phone ? 300 : 320, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ImageDropZone url={null} emptyTitle={image ? 'Or use another picture' : 'Drop a picture'} small busy={busy}
          onBlob={async (img) => { await write(await shrinkForVision(img.blob)); }} />
        {error && <div style={{ fontSize: 12, fontWeight: 600, color: note ? 'var(--il-warn)' : 'var(--il-err)' }}>{error}</div>}
        <Button tone="ghost" size={size} icon={<IconPhotoScan size={14} />}
          onClick={() => {
            setOpen(false);
            if (image) void fetch(image).then((r) => r.blob()).then((blob) => openSnippetsFromImage({ blob, name: 'snippet picture', categoryId }));
            else openSnippetsFromImage({ categoryId });
          }}>Several from a picture…</Button>
      </Popover.Dropdown>
    </Popover>
  );
}
