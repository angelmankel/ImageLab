/**
 * Item 42: the quick snippet modal — "+" in the grid / pills, ☆ on a prompt part, Edit on a tile.
 * Only the text is needed: one big box, focused. Name (made from the text when empty, shown as the
 * placeholder), category (the shared SearchSelect, never a native list) and a small picture (the
 * shared drop zone: drop · Paste · Upload) are optional. Enter saves, Shift+Enter = new line, Esc
 * closes. Editing shows Delete too. Every save / delete is one app undo step (`snippetOps`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { SnippetCategory } from '@/lib/types';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SearchSelect } from '~/ui';
import { ImageDropZone } from '~/compose';
import { T } from '~/theme/tokens';
import { isModelSpecific } from '../prompt/promptSearch';
import { useTileEdit } from '../prompt/tileStore';
import { autoName, UNCATEGORIZED } from './snippetModel';
import { addSnippets, deleteSnippets, snippetPicture, updateSnippet } from './snippetOps';

const field: React.CSSProperties = {
  width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)',
  fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--il-dim)', margin: '0 0 6px' };
const opt: React.CSSProperties = { textTransform: 'none', letterSpacing: 0, fontWeight: 600 };

/** The category choices for a kind: the kind's own first, then the rest (model-specific never). */
export function categoryOptions(cats: SnippetCategory[], negative: boolean) {
  const ok = cats.filter((c) => !isModelSpecific({ id: '', categoryId: c.id }));
  const mine = (c: SnippetCategory) => (c.id.startsWith('neg-') === negative) || c.id === UNCATEGORIZED;
  return [...ok.filter(mine), ...ok.filter((c) => !mine(c))].map((c) => ({ value: c.id, label: `${c.icon ? `${c.icon} ` : ''}${c.name.replace(/^negative\s*[·:\-–—]\s*/i, '')}` }));
}

export function SnippetEditor() {
  const editing = useTileEdit((s) => s.editing);
  const draftText = useTileEdit((s) => s.draftText);
  const draftCat = useTileEdit((s) => s.draftCat);
  const close = () => useTileEdit.getState().edit(null);
  const snippets = useStore((s) => s.snippets);
  const cats = useStore((s) => s.snippetCategories);
  const snip = editing && editing !== 'new' && editing !== 'new-neg' ? snippets.find((s) => s.id === editing) : undefined;
  const opened = editing === 'new' || editing === 'new-neg' || !!snip;
  return (
    <EditorModal key={editing ?? ''} opened={opened} onClose={close} snip={snip} negative={editing === 'new-neg' || snip?.kind === 'negative'}
      draftText={draftText} draftCat={draftCat} cats={cats} />
  );
}

function EditorModal({ opened, onClose, snip, negative, draftText, draftCat, cats }: {
  opened: boolean; onClose: () => void; snip: ReturnType<typeof useStore.getState>['snippets'][number] | undefined; negative: boolean;
  draftText: string; draftCat: string; cats: SnippetCategory[];
}) {
  const phone = useIsPhone();
  const preset = !!snip?.layers;
  const [text, setText] = useState(snip ? snip.text : draftText);
  const [name, setName] = useState(snip?.name ?? '');
  const options = useMemo(() => categoryOptions(cats, negative), [cats, negative]);
  const fallbackCat = negative ? (cats.find((c) => c.id.startsWith('neg-'))?.id ?? UNCATEGORIZED) : UNCATEGORIZED;
  const [cat, setCat] = useState(snip?.categoryId ?? (draftCat && cats.some((c) => c.id === draftCat) ? draftCat : fallbackCat));
  const [image, setImage] = useState<string | undefined>(snip?.image);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (opened) requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(box.current.value.length, box.current.value.length); }); }, [opened]);

  const ok = preset || !!text.trim();
  const save = () => {
    if (!ok) return;
    if (snip) {
      updateSnippet(snip.id, {
        name: name.trim() || autoName(preset ? snip.name : text),
        categoryId: cat,
        ...(preset ? {} : { text: text.trim() }),
        image,
      });
    } else addSnippets([{ text, name, categoryId: cat, kind: negative ? 'negative' : 'positive', image }]);
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) { e.preventDefault(); save(); }
  };

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={500} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)' } }}>
      <div data-no-swipe style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: phone ? '14px 14px 18px' : '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{snip ? 'Edit snippet' : negative ? 'New negative snippet' : 'New snippet'}</div>
          {!phone && <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}>Enter saves</div>}
        </div>

        {preset ? (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', background: 'var(--il-bg-deep)', borderRadius: 10, padding: '10px 12px' }}>
            {snip!.layers!.map((l) => l.text).join(' · ')}
            <div style={{ fontSize: 11, color: 'var(--il-dim)', marginTop: 4 }}>A preset (prompt + negative): its text is kept as is.</div>
          </div>
        ) : (
          <textarea ref={box} aria-label="What it puts in the prompt" rows={phone ? 5 : 4} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
            placeholder={negative ? 'What it keeps out… blurry, lowres' : 'What it puts in the prompt… golden hour, warm rim light'}
            spellCheck={false} style={{ ...field, fontSize: 15, lineHeight: 1.5, padding: '10px 12px', resize: 'vertical', minHeight: 96 }} />
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: phone ? 'wrap' : 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, width: phone ? '100%' : undefined }}>
            <div>
              <div style={lbl}>Name <span style={opt}>· optional</span></div>
              <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
                placeholder={(preset ? snip!.name : text.trim() ? autoName(text) : '') || 'Made from the text'}
                style={{ ...field, height: phone ? 44 : 36, padding: '0 10px', fontSize: 13 }} />
            </div>
            <div>
              <div style={lbl}>Category <span style={opt}>· optional</span></div>
              <SearchSelect label="Category" value={cat} onChange={setCat} options={options} size={phone ? 'lg' : 'md'} />
            </div>
          </div>
          <div style={{ width: phone ? '100%' : 170, flex: 'none' }}>
            <div style={lbl}>Picture <span style={opt}>· optional</span></div>
            <ImageDropZone small url={image ?? null} emptyTitle="Drop a picture"
              onBlob={async (img) => { setImage(await snippetPicture(img.blob)); }}
              onClear={() => setImage(undefined)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          {snip && (
            <Button tone="ghost" size={phone ? 'lg' : 'md'} icon={<IconTrash size={14} />} style={{ color: 'var(--il-err)' }}
              onClick={() => { deleteSnippets([snip.id]); onClose(); }}>Delete</Button>
          )}
          <div style={{ flex: 1 }} />
          <Button tone="card" size={phone ? 'lg' : 'md'} onClick={onClose}>Cancel</Button>
          <Button tone="primary" size={phone ? 'lg' : 'md'} disabled={!ok} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
