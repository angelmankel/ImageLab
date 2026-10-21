/**
 * THE input-image drop zone (fix list 41, list 2 items 34 + 36), one component for every picture
 * slot in the app: the Image step's input, a step 2+'s own picture, the Video start / end frame and
 * H3 references, every LoadImage slot of a workflow, the ControlNet guide. Empty: a dashed well —
 * drop, paste, Upload, Library (history · liked · Collections · on the server), Paste. Filled: a
 * label row (the slot's name, where the picture came from, a small Clear at the right end), the
 * picture whole (checkerboard behind transparency, its size as a badge bottom-left), then Replace ·
 * Library · Paste · Edit as one joined group — in a narrow panel an icon column beside the picture.
 * Paste is always there (button + Ctrl+V while hovered / focused, `usePaste`). While any picture is
 * dragged (the `~/dnd` layer) the zone glows. It registers itself with the phone's Send-to sheet.
 * The caller only gets a Blob (`onBlob`) or a server file (`onServerFile`) and stores it its own way.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconUpload, IconPhoto, IconBrush, IconX, IconArrowUp } from '@tabler/icons-react';
import { dropToBlob, makePayload, useImageDrag, useImageDrop, useRegisterDropTarget, type DropItem, type ImportedBlob } from '~/dnd';
import { useIsPhone } from '~/app/useIsPhone';
import { Button } from '~/ui';
import { T } from '~/theme/tokens';
import { LibraryPicker, type LibraryPick, type ServerFiles } from './LibraryPicker';
import { ORIGIN_LABEL, displayName, fmtDims, originOfDrop, type Origin } from './inputLogic';
import { usePaste } from './usePaste';
import { PasteButton, PasteNote } from './PasteButton';

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
  /** The slot's name, in the row above the picture (the small Clear sits at its right end). */
  label?: ReactNode;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const checker: CSSProperties = { background: 'repeating-conic-gradient(#18181b 0 25%, #121214 0 50%) 0 0 / 16px 16px' };

export function ImageDropZone(p: ImageDropZoneProps) {
  const { url, name, dims, origin, onBlob, onServerFile, server, onClear, onEdit, small = false, emptyTitle, busy: busyProp, target, pasteAnywhere, extra, label } = p;
  const phone = useIsPhone();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState(false);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => { setMeasured(null); }, [url]);
  const working = busy || !!busyProp;

  // Why the last picture could not be used: one line under the zone (no toast, item 12).
  const sayRef = useRef<(t: string | null) => void>(() => {});
  const take = useCallback(async (item: DropItem, from: Origin) => {
    setBusy(true);
    sayRef.current(null);
    try {
      const img = await dropToBlob(item);
      if (/^(text\/|application\/(json|xml))/i.test(img.blob.type)) throw new Error('that link is a page, not a picture');
      await onBlob(img, from);
    } catch (e) {
      const m = errMsg(e);
      sayRef.current(/^Could not fetch/.test(m) ? 'Could not load the picture from that link.' : `Could not use that picture: ${m}`);
    } finally { setBusy(false); }
  }, [onBlob]);
  const takeFile = (f: File | null | undefined, from: Origin) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name)) { sayRef.current(`Not a picture: ${f.name}`); return; }
    void take({ kind: 'file', file: f, name: f.name || 'pasted.png' }, from);
  };
  const takePick = (pk: LibraryPick) => {
    if (pk.serverFile && onServerFile) { void Promise.resolve(onServerFile(pk.serverFile)); return; }
    void take({ kind: 'url', url: pk.url, name: pk.name, payload: null }, pk.origin);
  };

  // A picture dragged out of this zone and let go on it again changes nothing.
  const drop = useImageDrop({ onDrop: (item) => void take(item, originOfDrop(item)), accept: (item) => !(item.kind === 'url' && url && item.url === url), disabled: working });
  useRegisterDropTarget(target ? { id: target.id, label: target.label, group: 'input', order: target.order, onDrop: (item) => void take(item, originOfDrop(item)) } : null, [target?.label, take]);

  // Paste (item 36): the button, Ctrl+V while hovered / focused, and page-wide for `pasteAnywhere`.
  const clip = usePaste({ onItem: (item) => void take(item, item.kind === 'url' && item.payload ? originOfDrop(item) : 'paste'), anywhere: !!pasteAnywhere, disabled: working });
  sayRef.current = clip.say;

  // A narrow panel (< 300px, not the phone): the actions go beside the picture as an icon column.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 300));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const side = narrow && !phone;
  const gh = phone ? 44 : side ? 40 : 32;
  const acts: Array<{ key: string; label: string; icon?: ReactNode; run?: () => void }> = [
    { key: 'replace', label: 'Replace', icon: <IconUpload size={14} />, run: () => fileRef.current?.click() },
    { key: 'library', label: 'Library', icon: <IconPhoto size={14} />, run: () => setLib(true) },
    { key: 'paste', label: 'Paste' },
    ...(onEdit ? [{ key: 'edit', label: 'Edit', icon: <IconBrush size={14} />, run: onEdit }] : []),
  ];

  const drag = useImageDrag(url ? () => makePayload({ url, name: displayName(name), source: 'input' }) : null);
  const size = dims ?? measured;
  const h = phone ? 'lg' : 'md';
  const glow = drop.over ? 'var(--il-ember)' : drop.active ? 'var(--il-ember-line)' : null;

  return (
    <div ref={rootRef} {...clip.zone} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { takeFile(e.target.files?.[0], 'upload'); e.target.value = ''; }} />
      {(label || (url && (origin || onClear))) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, minHeight: 24 }}>
          {label && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', flex: 'none' }}>{label}</span>}
          {url && origin && <span style={{ fontSize: 11, fontWeight: 700, color: origin === 'step' ? 'var(--il-ember-hi)' : 'var(--il-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ORIGIN_LABEL[origin]}</span>}
          <span style={{ flex: 1 }} />
          {url && onClear && (
            <Button size={phone ? 'md' : 'sm'} h={phone ? 40 : 24} tone="ghost" icon={<IconX size={13} />} onClick={onClear} disabled={working} style={{ padding: '0 9px 0 7px', fontSize: 11, flex: 'none' }}>Clear</Button>
          )}
        </div>
      )}
      {url ? (
        <>
          <div style={{ display: 'flex', flexDirection: side ? 'row' : 'column', gap: 8, minWidth: 0 }}>
            <div {...drop.props} tabIndex={0} aria-label="Input picture: drop or paste another picture to replace it"
              style={{ ...checker, position: 'relative', flex: side ? 1 : undefined, minWidth: 0, width: side ? undefined : '100%', aspectRatio: side ? undefined : small ? '16 / 7' : '4 / 3', height: side ? (small ? 140 : 200) : undefined, maxHeight: small ? 140 : 260, borderRadius: T.radius.lg, overflow: 'hidden', display: 'grid', placeItems: 'center', outline: glow ? `2px dashed ${glow}` : undefined, outlineOffset: -2, opacity: working ? 0.55 : 1, transition: 'opacity .12s' }}>
              <img src={url} alt="" {...drag} onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setMeasured({ width: i.naturalWidth, height: i.naturalHeight }); }}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', cursor: 'grab' }} />
              {size && !drop.over && (
                <span style={{ position: 'absolute', left: 8, bottom: 8, height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--il-panel)', color: 'var(--il-fg)', boxShadow: '0 0 0 1px var(--il-line-strong)', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', pointerEvents: 'none' }}>
                  {fmtDims(size.width, size.height)}
                </span>
              )}
              {drop.over && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--il-ember-soft) 88%, transparent)', color: 'var(--il-ember-hi)', fontWeight: 800, fontSize: 13, pointerEvents: 'none' }}>Drop to replace</div>}
            </div>
            {/* Replace · Library · Paste · Edit: one joined group; a narrow panel stacks it beside the picture, icons only. */}
            <div role="group" aria-label="Picture actions" style={{ display: 'flex', flexDirection: side ? 'column' : 'row', flex: 'none', borderRadius: T.radius.md, overflow: 'hidden', background: 'var(--il-elev)', alignSelf: side ? 'flex-start' : undefined }}>
              {acts.map((a, i) => {
                const st: CSSProperties = { borderRadius: 0, flex: side ? 'none' : 1, minWidth: 0, width: side ? gh : undefined, boxShadow: i ? (side ? 'inset 0 1px 0 var(--il-line)' : 'inset 1px 0 0 var(--il-line)') : undefined };
                if (a.key === 'paste') return <PasteButton key={a.key} size={phone ? 'lg' : 'sm'} h={gh} iconOnly={side} onPaste={() => void clip.paste()} disabled={working} style={st} />;
                return <Button key={a.key} size={phone ? 'lg' : 'sm'} h={gh} icon={a.icon} onClick={a.run} disabled={working} tooltip={side ? a.label : undefined} tipPos="left" aria-label={a.label} style={st}>{side ? undefined : a.label}</Button>;
              })}
            </div>
          </div>
          {extra && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{extra}</div>}
        </>
      ) : (
        <div {...drop.props} role="button" tabIndex={0} aria-label={`${emptyTitle ?? 'Drop a picture'}: drop, paste, or tap to upload`}
          onClick={(e) => { if (e.target === e.currentTarget) fileRef.current?.click(); }}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
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
              <PasteButton size={phone ? 'lg' : small ? 'sm' : h} onPaste={() => void clip.paste()} disabled={working} />
              {extra}
            </div>
          )}
        </div>
      )}
      <PasteNote note={clip.note} />
      <LibraryPicker opened={lib} onClose={() => setLib(false)} onPick={takePick} server={onServerFile ? server : null} />
    </div>
  );
}
