/**
 * Item 42 redesign: the snippet's picture slot — one calm square. Empty: a dashed square with
 * "Drop or paste a picture" and Paste · Upload. Filled: the picture, a small × on its corner, and
 * Replace · Paste on hover (always shown on a touch screen). Ctrl+V over / in it pastes, a dropped
 * picture is taken (`usePaste` + `PasteButton`, `useImageDrop`; fix list 2 item 36).
 */
import { useRef, useState } from 'react';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { dropToBlob, useImageDrop, type DropItem } from '~/dnd';
import { PasteButton, PasteNote, usePaste } from '~/compose';
import { Button, Tip } from '~/ui';
import './snippetPicture.css';

export function SnippetPicture({ url, onBlob, onClear, size }: { url: string | null; onBlob: (blob: Blob) => Promise<void> | void; onClear: () => void; size: number | string }) {
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const touch = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;
  const take = async (item: DropItem) => {
    setBusy(true);
    try { await onBlob((await dropToBlob(item)).blob); } catch { say('Could not use that picture.'); } finally { setBusy(false); }
  };
  const { zone, paste, note, say } = usePaste({ onItem: (item) => { void take(item); } });
  const drop = useImageDrop({ onDrop: (item) => { void take(item); } });
  const takeFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { await onBlob(f); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: size }}>
      <div {...zone} {...drop.props} tabIndex={0} aria-label="Picture" className={`il-snip-pic${url ? ' has-pic' : ''}${touch ? ' is-touch' : ''}`}
        style={{
          position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden', outline: 'none',
          border: url ? '1px solid var(--il-line-soft)' : `1.5px dashed ${drop.over ? 'var(--il-ember)' : 'var(--il-line-strong)'}`,
          background: url ? 'var(--il-bg-deep)' : drop.over ? 'var(--il-ember-soft)' : 'var(--il-bg-deep)', opacity: busy ? 0.6 : 1,
        }}>
        {url ? (
          <>
            <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <Tip label="Remove picture">
              <button type="button" aria-label="Remove picture" onClick={onClear} className="il-snip-pic-x"
                style={{ position: 'absolute', top: 6, right: 6, width: touch ? 32 : 24, height: touch ? 32 : 24, borderRadius: '50%', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(0,0,0,.6)', color: '#fff' }}>
                <IconX size={13} stroke={2.8} />
              </button>
            </Tip>
            <div className="il-snip-pic-tools" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', gap: 6, padding: 8, background: 'linear-gradient(transparent, rgba(0,0,0,.6))' }}>
              <Button size="sm" tone="elev" icon={<IconUpload size={13} />} aria-label="Replace picture" tooltip="Replace" onClick={() => file.current?.click()} />
              <PasteButton iconOnly onPaste={() => { void paste(); }} />
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10, textAlign: 'center' }}>
            <IconPhoto size={26} stroke={1.6} style={{ color: 'var(--il-dim)' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', lineHeight: 1.35 }}>Drop or paste<br />a picture</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <PasteButton iconOnly onPaste={() => { void paste(); }} />
              <Button size="sm" tone="card" icon={<IconUpload size={13} />} aria-label="Upload a picture" tooltip="Upload" onClick={() => file.current?.click()} />
            </div>
          </div>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void takeFile(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
      </div>
      <PasteNote note={note} />
    </div>
  );
}
