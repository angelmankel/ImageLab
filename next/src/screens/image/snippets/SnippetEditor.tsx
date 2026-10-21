/**
 * Item 42 (redesigned): the snippet modal — "+" in the grid / pills, ☆ on a prompt part, Edit on a
 * tile. A calm two-column layout: a square picture slot on the left (drop · Paste · Upload, × on
 * its corner), the text (focused), name and category on the right; phone: stacked, picture last.
 * Only the text is needed (one note says so): the name is made from the text when empty (shown as
 * the placeholder), the category is the shared SearchSelect. A "✦ From image" spot sits top-right. Enter saves, Shift+Enter = new line, Esc
 * closes. Editing shows Delete too. Every save / delete is one app undo step (`snippetOps`).
 */
import { createElement, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Modal } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { SnippetCategory } from '@/lib/types';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, SearchSelect } from '~/ui';
import { T } from '~/theme/tokens';
import { isModelSpecific } from '../prompt/promptSearch';
import { useTileEdit } from '../prompt/tileStore';
import { autoName, UNCATEGORIZED } from './snippetModel';
import { addSnippets, deleteSnippets, snippetPicture, updateSnippet } from './snippetOps';
import { SnippetPicture } from './SnippetPicture';

/**
 * The "✦ From image" spot (writeit's item): `writeIt/SnippetFromImage.tsx` exporting
 * `SnippetFromImage` gets { image (the slot's picture data URL or null), categoryId, negative,
 * onText({ text, name? }) } and renders its own button. A glob that matches nothing = no button.
 */
export interface SnippetFromImageProps { image: string | null; categoryId: string; negative: boolean; onText: (v: { text: string; name?: string }) => void }
const fromImageMods = import.meta.glob('../writeIt/SnippetFromImage.tsx', { eager: true }) as Record<string, { SnippetFromImage?: ComponentType<SnippetFromImageProps> }>;
const fromImageButton = () => Object.values(fromImageMods)[0]?.SnippetFromImage ?? null;

const field: React.CSSProperties = {
  width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)',
  fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--il-dim)', margin: '0 0 6px' };

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

  const fromImage = fromImageButton();
  const pic = (
    <SnippetPicture size={phone ? 'min(100%, 220px)' : 176} url={image ?? null}
      onBlob={async (blob) => { setImage(await snippetPicture(blob)); }} onClear={() => setImage(undefined)} />
  );
  const btn = phone ? 'lg' : 'md';

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={640} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)' } }}>
      <div data-no-swipe style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: phone ? '16px 16px 20px' : '20px 22px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 }}>
          <div style={{ fontSize: 17, fontWeight: 800, flex: 1, minWidth: 0 }}>{snip ? 'Edit snippet' : negative ? 'New negative snippet' : 'New snippet'}</div>
          {/* The "✦ From image" spot (writeit's helper fills it when present). */}
          {fromImage && !preset && createElement(fromImage, {
            image: image ?? null, categoryId: cat, negative,
            onText: (v: { text: string; name?: string }) => { setText(v.text); if (v.name && !name.trim()) setName(v.name); },
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: phone ? 'column' : 'row', gap: phone ? 16 : 20, alignItems: phone ? 'stretch' : 'flex-start' }}>
          {!phone && pic}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={lbl}>{negative ? 'What it keeps out' : 'What it puts in the prompt'}</span>
              {preset ? (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', background: 'var(--il-bg-deep)', borderRadius: 10, padding: '10px 12px' }}>
                  {snip!.layers!.map((l) => l.text).join(' · ')}
                  <div style={{ fontSize: 11, color: 'var(--il-dim)', marginTop: 4 }}>A preset (prompt + negative): its text is kept as is.</div>
                </div>
              ) : (
                <textarea ref={box} rows={phone ? 4 : 4} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
                  placeholder={negative ? 'blurry, lowres, extra fingers' : 'golden hour, warm rim light'}
                  spellCheck={false} style={{ ...field, fontSize: 15, lineHeight: 1.5, padding: '10px 12px', resize: 'vertical', minHeight: 104 }} />
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={lbl}>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
                  placeholder={(preset ? snip!.name : text.trim() ? autoName(text) : '') || 'Made from the text'}
                  style={{ ...field, height: phone ? 44 : 36, padding: '0 10px', fontSize: 13 }} />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={lbl}>Category</span>
                <SearchSelect label="Category" value={cat} onChange={setCat} options={options} size={phone ? 'lg' : 'md'} />
              </div>
            </div>
          </div>
          {phone && <div><span style={{ ...lbl, display: 'block' }}>Picture</span>{pic}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--il-line-soft)', paddingTop: 14 }}>
          {snip && (
            <Button tone="ghost" size={btn} icon={<IconTrash size={14} />} style={{ color: 'var(--il-err)' }}
              onClick={() => { deleteSnippets([snip.id]); onClose(); }}>Delete</Button>
          )}
          <span style={{ flex: 1, minWidth: 120, fontSize: 11, fontWeight: 600, color: 'var(--il-dim)' }}>
            Only the text is needed{phone ? '.' : ' · Enter saves'}
          </span>
          <Button tone="card" size={btn} onClick={onClose}>Cancel</Button>
          <Button tone="primary" size={btn} disabled={!ok} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
