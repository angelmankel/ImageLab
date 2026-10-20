/**
 * One collection in the history panel's row (FIXLIST 21, Donny's sketch): a square tile with the
 * newest picture as its cover, the name and count over a bottom fade, a red × on its corner
 * (delete the collection, not its pictures; Undo), and a drop target: a picture dragged onto it
 * moves there. Click = show it in the grid (again = back to the history). Double-click the name
 * (or the menu's Rename) edits it in place. Right-click / long-press: the 'collection' menu.
 */
import { useEffect, useRef, useState } from 'react';
import { IconFolder, IconX } from '@tabler/icons-react';
import type { Collection } from '@/lib/types';
import { menuProps } from '~/app/contextMenu';
import { useImageDrop, useRegisterDropTarget } from '~/dnd';
import { addImageToCollection, deleteCollection, renameCollection, startRename, useCollectionsUi } from './collectionActions';

export const TILE = 68;

export function CollectionTile({ c, count, cover, coverIsVideo, active, onPick }: {
  c: Collection; count: number; cover: string; coverIsVideo: boolean; active: boolean; onPick: () => void;
}) {
  const renaming = useCollectionsUi((s) => s.renaming === c.id);
  const drop = useImageDrop({ onDrop: (item) => void addImageToCollection(c.id, item) });
  // The phone's Send-to sheet (long-press a picture) lists every collection on screen.
  useRegisterDropTarget({ id: `collection:${c.id}`, label: `Collection · ${c.name}`, group: 'collection', onDrop: (item) => void addImageToCollection(c.id, item) }, [c.name]);
  const ring = drop.over ? '2px solid var(--il-ember)' : active ? '2px solid var(--il-ember)' : drop.active ? '2px dashed var(--il-ember-line)' : '1px solid var(--il-line-soft)';
  return (
    <div {...drop.props} {...menuProps('collection', c)}
      style={{ position: 'relative', width: TILE, height: TILE, flex: 'none', transform: drop.over ? 'scale(1.06)' : undefined, transition: 'transform .12s' }}>
      <button type="button" onClick={onPick} onDoubleClick={() => startRename(c.id)} aria-pressed={active}
        aria-label={`${c.name}, ${count} picture${count === 1 ? '' : 's'}${active ? ' (shown)' : ''}`} title={`${c.name} · ${count} · drop pictures here`}
        style={{
          position: 'absolute', inset: 0, padding: 0, border: 0, borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
          outline: ring, outlineOffset: -1, background: cover ? 'var(--il-bg-deep)' : 'linear-gradient(145deg, var(--il-card-on), var(--il-elev))',
          color: 'var(--il-fg)',
        }}>
        {cover && (coverIsVideo
          ? <video src={cover} muted playsInline preload="metadata" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          : <img src={cover} alt="" loading="lazy" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />)}
        {!cover && <IconFolder size={22} stroke={1.8} style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)', color: 'var(--il-muted)' }} />}
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, background: 'linear-gradient(transparent, rgba(15,15,17,.85))' }} />
        {!renaming && (
          <span style={{ position: 'absolute', left: 6, right: 6, bottom: 5, display: 'flex', alignItems: 'baseline', gap: 4, textAlign: 'left' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--il-fg2)' }}>{count}</span>
          </span>
        )}
      </button>
      {renaming && <RenameBox c={c} />}
      <button type="button" onClick={(e) => { e.stopPropagation(); deleteCollection(c.id); }} aria-label={`Delete ${c.name} (its pictures stay)`}
        title="Delete this collection · its pictures stay (Undo in the note)"
        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, padding: 0, border: '2px solid var(--il-panel)', borderRadius: '50%', background: 'var(--il-err)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <IconX size={11} stroke={3} />
      </button>
    </div>
  );
}

function RenameBox({ c }: { c: Collection }) {
  const [v, setV] = useState(c.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const done = (save: boolean) => { if (save && v.trim()) renameCollection(c.id, v); startRename(null); };
  return (
    <input ref={ref} value={v} onChange={(e) => setV(e.currentTarget.value)} aria-label="Collection name" maxLength={40}
      onKeyDown={(e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); e.stopPropagation(); }}
      onBlur={() => done(true)}
      style={{ position: 'absolute', left: 3, right: 3, bottom: 3, height: 22, padding: '0 5px', border: '1px solid var(--il-ember)', borderRadius: 8, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 10, fontWeight: 800, outline: 'none', minWidth: 0 }} />
  );
}
