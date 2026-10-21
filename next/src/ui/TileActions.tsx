/**
 * Fix list 2 ("consistent image clicks + tile actions"): ONE behaviour for every picture tile in
 * every grid (history panel, collections, the History page):
 *   - `tileClick(selected, select, open)`: the first click selects (shows it on the canvas / the
 *     preview), a click on the tile that is already selected opens the full-screen viewer.
 *     No separate full-screen button, no double-click needed.
 *   - `<TileActions>`: 🗑 delete in the top-left corner, ♥ favourite in the top-right, the same
 *     icons and size everywhere; shown on hover (keyboard focus too), the ♥ always when liked, and
 *     on touch on the selected tile. Put it as a DIRECT child of the tile box (position: relative)
 *     and mark the box `data-tile-selected` (CSS in styles/next.css). Delete = the shared delete
 *     (`~/app/deleteResult`, Ctrl+Z, no toast) — the caller passes it.
 */
import type { CSSProperties } from 'react';
import { IconHeart, IconHeartFilled, IconTrash } from '@tabler/icons-react';

/** Click handler: select, or open when it is already selected. */
export function tileClick(selected: boolean, select: () => void, open: () => void): () => void {
  return () => (selected ? open() : select());
}

const corner = (size: number): CSSProperties => ({
  position: 'absolute', top: 6, width: size, height: size, padding: 0, border: 0, borderRadius: '50%', zIndex: 1,
  background: 'color-mix(in srgb, var(--il-bg-deep) 60%, transparent)', display: 'grid', placeItems: 'center', cursor: 'pointer',
});

export function TileActions({ liked = false, onLike, onDelete, deleteLabel = 'Delete', phone = false }: {
  liked?: boolean;
  /** No handler = no ♥ (a result without a history entry). */
  onLike?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  /** Bigger targets on a phone. */
  phone?: boolean;
}) {
  const size = phone ? 34 : 26;
  const icon = phone ? 16 : 13;
  return (
    <>
      {onDelete && (
        <button type="button" className="il-tile-del" aria-label={deleteLabel} title={deleteLabel}
          onClick={(e) => { e.stopPropagation(); onDelete(); }} onDoubleClick={(e) => e.stopPropagation()}
          style={{ ...corner(size), left: 6, color: 'color-mix(in srgb, var(--il-fg) 80%, transparent)' }}>
          <IconTrash size={icon} stroke={2.4} />
        </button>
      )}
      {onLike && (
        <button type="button" className="il-tile-like" aria-label={liked ? 'Unfavourite' : 'Favourite'} aria-pressed={liked} title={liked ? 'Unfavourite' : 'Favourite'}
          onClick={(e) => { e.stopPropagation(); onLike(); }} onDoubleClick={(e) => e.stopPropagation()}
          style={{ ...corner(size), right: 6, color: liked ? 'var(--il-ember)' : 'color-mix(in srgb, var(--il-fg) 80%, transparent)' }}>
          {liked ? <IconHeartFilled size={icon} /> : <IconHeart size={icon} stroke={2.4} />}
        </button>
      )}
    </>
  );
}
