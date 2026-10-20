/**
 * THE input-image drop zone (fix list 41), one component for every picture slot in the app: the
 * Image step's input, a step 2+'s own picture, the Video start / end frame and H3 references,
 * every LoadImage slot of a workflow. Empty: a dashed well — drop, paste, tap Upload, or Library
 * (history · liked · Collections · on the server). Filled: the picture whole (checkerboard behind
 * transparency, nothing on top of it), ONE line under it — where it came from, its name, its size —
 * and Replace · Library · Edit · Clear. While any picture is dragged (the `~/dnd` layer) the zone
 * glows; over it, it says so. It registers itself with the phone's Send-to sheet. The caller only
 * gets a Blob (`onBlob`) or a server file (`onServerFile`) and stores it its own way.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconPhoto, IconBrush, IconX, IconClipboard, IconArrowUp } from '@tabler/icons-react';
import { dropToBlob, makePayload, useImageDrag, useImageDrop, useRegisterDropTarget, type DropItem, type ImportedBlob } from '~/dnd';
import { useIsPhone } from '~/app/useIsPhone';
import { Button } from '~/ui';
import { T } from '~/theme/tokens';
import { LibraryPicker, type LibraryPick, type ServerFiles } from './LibraryPicker';
import { ORIGIN_LABEL, displayName, fmtDims, originOfDrop, type Origin } from './inputLogic';

export interface ImageDropZoneProps {
  /** The picture shown (a data / blob / http URL), or null when the slot is empty. */
  url: string | null;
  /** Its file name (shown once, cleaned). */
  name?: string | null;
  /** Its size when known; otherwise read from the picture. */
  dims?: { width: number; height: number } | null;
  /** Where it came from (the badge); null = no badge. */
  origin?: Origin | null;
  /** A picture was given: store it. May be async (an upload); the zone shows busy meanwhile. */
  onBlob: (img: ImportedBlob, origin: Origin) => unknown;
  /** A file already on the server was picked (Library → On the server). */
  onServerFile?: (file: string) => unknown;
  /** Files already on the server (a workflow's LoadImage list): adds Library → On the server. */
  server?: ServerFiles | null;
  onClear?: () => void;
  onEdit?: () => void;
  /** Small = a secondary slot (end frame, an extra picture): a flatter well. */
  small?: boolean;
  /** The empty well's title ("Drop a picture", "Add an end frame"). */
  emptyTitle?: string;
  busy?: boolean;
  /** Registers this zone in the phone's Send-to sheet (and right-click Send to) under this label. */
  target?: { id: string; label: string; order?: number } | null;
  /** Take a paste anywhere on the page (not in a text box) while this zone is on screen. One zone per screen. */
  pasteAnywhere?: boolean;
  /** Extra buttons after the zone's own (a "Step 1's output" shortcut…). */
  extra?: ReactNode;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isEditable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** A picture from a ClipboardEvent / DataTransfer item list. */
function clipboardImage(e: ClipboardEvent | globalThis.ClipboardEvent): File | null {
  const items = Array.from(e.clipboardData?.items ?? []);
  const it = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  return it?.getAsFile() ?? null;
}

const checker: CSSProperties = { background: 'repeating-conic-gradient(#18181b 0 25%, #121214 0 50%) 0 0 / 16px 16px' };

export function ImageDropZone(p: ImageDropZoneProps) {
  const { url, name, dims, origin, onBlob, onServerFile, server, onClear, onEdit, small = false, emptyTitle, busy: busyProp, target, pasteAnywhere, extra } = p;
  const phone = useIsPhone();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState(false);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => { setMeasured(null); }, [url]);
  const working = busy || !!busyProp;

  const take = useCallback(async (item: DropItem, from: Origin) => {
    setBusy(true);
    try {
      const img = await dropToBlob(item);
      await onBlob(img, from);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not use that picture', message: errMsg(e), autoClose: 3000 });
    } finally { setBusy(false); }
  }, [onBlob]);
  const takeFile = (f: File | null | undefined, from: Origin) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name)) { notifications.show({ color: 'red', title: 'Not a picture', message: f.name, autoClose: 3000 }); return; }
    void take({ kind: 'file', file: f, name: f.name || 'pasted.png' }, from);
  };
  const takePick = (pk: LibraryPick) => {
    if (pk.serverFile && onServerFile) { void Promise.resolve(onServerFile(pk.serverFile)); return; }
    void take({ kind: 'url', url: pk.url, name: pk.name, payload: null }, pk.origin);
  };

  // A picture dragged out of this zone and let go on it again changes nothing.
  const drop = useImageDrop({ onDrop: (item) => void take(item, originOfDrop(item)), accept: (item) => !(item.kind === 'url' && url && item.url === url), disabled: working });
  useRegisterDropTarget(target ? { id: target.id, label: target.label, group: 'input', order: target.order, onDrop: (item) => void take(item, originOfDrop(item)) } : null, [target?.label, take]);

  // Paste anywhere on the page while this zone is up (the Composition tab's main slot).
  const takeRef = useRef(takeFile);
  takeRef.current = takeFile;
  useEffect(() => {
    if (!pasteAnywhere) return;
    const on = (e: globalThis.ClipboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target)) return;
      const f = clipboardImage(e);
      if (f) { e.preventDefault(); takeRef.current(f, 'paste'); }
    };
    window.addEventListener('paste', on);
    return () => window.removeEventListener('paste', on);
  }, [pasteAnywhere]);

  const canReadClipboard = !phone && typeof navigator !== 'undefined' && !!navigator.clipboard && 'read' in navigator.clipboard;
  const pasteButton = async () => {
    try {
      for (const it of await navigator.clipboard.read()) {
        const type = it.types.find((t) => t.startsWith('image/'));
        if (type) { const b = await it.getType(type); takeFile(new File([b], `pasted.${type.split('/')[1] || 'png'}`, { type }), 'paste'); return; }
      }
      notifications.show({ title: 'No picture on the clipboard', message: 'Copy a picture first.', autoClose: 3000 });
    } catch (e) { notifications.show({ color: 'red', title: 'Could not read the clipboard', message: errMsg(e), autoClose: 3000 }); }
  };

  const drag = useImageDrag(url ? () => makePayload({ url, name: displayName(name), source: 'input' }) : null);
  const size = dims ?? measured;
  const h = phone ? 'lg' : 'md';
  const glow = drop.over ? 'var(--il-ember)' : drop.active ? 'var(--il-ember-line)' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { takeFile(e.target.files?.[0], 'upload'); e.target.value = ''; }} />
      {url ? (
        <>
          <div {...drop.props} tabIndex={0} aria-label={`${displayName(name)}: drop or paste another picture to replace it`}
            onPaste={(e) => { const f = clipboardImage(e); if (f) { e.preventDefault(); takeFile(f, 'paste'); } }}
            style={{ ...checker, position: 'relative', width: '100%', aspectRatio: small ? '16 / 7' : '4 / 3', maxHeight: small ? 130 : 260, borderRadius: T.radius.lg, overflow: 'hidden', display: 'grid', placeItems: 'center', outline: glow ? `2px dashed ${glow}` : undefined, outlineOffset: -2, opacity: working ? 0.55 : 1, transition: 'opacity .12s' }}>
            <img src={url} alt="" {...drag} onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setMeasured({ width: i.naturalWidth, height: i.naturalHeight }); }}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', cursor: 'grab' }} />
            {drop.over && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(42,36,32,.82)', color: 'var(--il-ember-hi)', fontWeight: 800, fontSize: 13, pointerEvents: 'none' }}>Drop to replace</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {origin && <span style={{ flex: 'none', height: 22, padding: '0 8px', borderRadius: 999, background: origin === 'step' ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: origin === 'step' ? 'var(--il-ember-hi)' : 'var(--il-fg2)', fontSize: 10, fontWeight: 800, letterSpacing: .3, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>{ORIGIN_LABEL[origin]}</span>}
            <span title={displayName(name)} style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(name)}</span>
            {size && <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>{fmtDims(size.width, size.height)}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size={phone ? 'lg' : 'sm'} icon={<IconUpload size={14} />} onClick={() => fileRef.current?.click()} disabled={working}>Replace</Button>
            <Button size={phone ? 'lg' : 'sm'} icon={<IconPhoto size={14} />} onClick={() => setLib(true)} disabled={working}>Library</Button>
            {canReadClipboard && <Button size="sm" icon={<IconClipboard size={14} />} onClick={() => void pasteButton()} disabled={working} tooltip="Paste a copied picture (Ctrl+V works too)">Paste</Button>}
            {onEdit && <Button size={phone ? 'lg' : 'sm'} icon={<IconBrush size={14} />} onClick={onEdit} disabled={working}>Edit</Button>}
            {extra}
            {onClear && <Button size={phone ? 'lg' : 'sm'} tone="danger" icon={<IconX size={14} />} onClick={onClear} disabled={working} style={{ marginLeft: 'auto' }}>Clear</Button>}
          </div>
        </>
      ) : (
        <div {...drop.props} role="button" tabIndex={0} aria-label={`${emptyTitle ?? 'Drop a picture'}: drop, paste, or tap to upload`}
          onClick={(e) => { if (e.target === e.currentTarget) fileRef.current?.click(); }}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
          onPaste={(e) => { const f = clipboardImage(e); if (f) { e.preventDefault(); takeFile(f, 'paste'); } }}
          style={{
            position: 'relative', width: '100%', aspectRatio: small ? '16 / 7' : '4 / 3', maxHeight: small ? 140 : 240, minHeight: small ? 120 : 190, borderRadius: T.radius.lg,
            border: `2px dashed ${glow ?? 'var(--il-line-strong)'}`, background: drop.over ? 'var(--il-ember-soft)' : drop.active ? '#1a1613' : 'var(--il-bg-deep)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: small ? 6 : 8, padding: 10, textAlign: 'center', cursor: 'pointer',
            opacity: working ? 0.6 : 1, transition: 'background-color .12s, border-color .12s',
          }}>
          {!small && <span aria-hidden style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--il-ember-soft)', color: 'var(--il-ember)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><IconArrowUp size={20} stroke={2.6} /></span>}
          <span style={{ fontSize: 13, fontWeight: 800, color: drop.over ? 'var(--il-ember-hi)' : 'var(--il-fg)', pointerEvents: 'none' }}>
            {working ? 'Loading…' : drop.over ? 'Release to use it' : emptyTitle ?? (phone ? 'Add a picture' : 'Drop a picture')}
          </span>
          {!small && !drop.over && !working && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', pointerEvents: 'none' }}>{phone ? 'Long-press any picture → Send to' : 'or paste it · from a file, a tab, the canvas, history'}</span>}
          {!drop.over && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size={phone ? 'lg' : small ? 'sm' : h} icon={<IconUpload size={14} />} onClick={() => fileRef.current?.click()} disabled={working}>Upload</Button>
              <Button size={phone ? 'lg' : small ? 'sm' : h} icon={<IconPhoto size={14} />} onClick={() => setLib(true)} disabled={working}>Library</Button>
              {canReadClipboard && !small && <Button size={h} icon={<IconClipboard size={14} />} onClick={() => void pasteButton()} disabled={working} tooltip="Paste a copied picture (Ctrl+V works too)">Paste</Button>}
              {extra}
            </div>
          )}
        </div>
      )}
      <LibraryPicker opened={lib} onClose={() => setLib(false)} onPick={takePick} server={onServerFile ? server : null} />
    </div>
  );
}
