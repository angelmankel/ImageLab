/**
 * Item 12: styles + snippets as ONE scrollable grid of square tiles, with a search box on top.
 * Manual: search, tap a tile to put it in / take it out of the prompt (the text itself — a tile is
 * on when its text is in the prompt). Auto: the words typed in the prompt pick the related tiles.
 * The name sits inside the tile (capped to fit); the picture is the tile's colour until it has
 * art. Right-click / long-press a tile: Edit · Delete (Undo) · Copy text ('style-tile' menu).
 */
import { Fragment, useMemo, useState } from 'react';
import { IconCheck, IconCopy, IconPencil, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import type { Snippet } from '@/lib/types';
import { registerMenu, menuProps } from '~/app/contextMenu';
import { useIsPhone } from '~/app/useIsPhone';
import { Button } from '~/ui';
import { SnippetForm } from '../snippets/SnippetForm';
import { deleteWithUndo } from '../snippets/snippetActions';
import { formatWeight, type Part } from './promptSections';
import { relatedTiles, searchTiles, tileBackground, tileHue, tileName } from './promptSearch';
import { useTileEdit, useTileUi, type GridMode } from './tileStore';
import type { Tiles } from './useTiles';

registerMenu<Snippet>('style-tile', [
  { id: 'edit', label: 'Edit', icon: IconPencil, action: (s) => useTileEdit.getState().edit(s.id) },
  { id: 'copy', label: 'Copy text', icon: IconCopy, action: (s) => { void navigator.clipboard?.writeText(s.layers ? s.layers.map((l) => l.text).join(', ') : s.text); } },
  { id: 'delete', label: 'Delete', icon: IconTrash, danger: true, group: 'danger', action: (s) => deleteWithUndo(s) },
]);

function Tile({ s, part, onToggle }: { s: Snippet; part: Part | undefined; onToggle: () => void }) {
  const on = !!part;
  const text = s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text;
  return (
    <button type="button" className={`il-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onToggle} title={`${s.name}\n${text}`}
      style={{ background: tileBackground(tileHue(s)) }} {...menuProps('style-tile', s)}>
      {on && <span className="il-tile-check" aria-hidden><IconCheck size={12} stroke={3.2} /></span>}
      {part && Math.abs(part.weight - 1) > 0.001 && <span className="il-tile-w">{formatWeight(part.weight)}</span>}
      <span className="il-tile-name">{tileName(s.name)}</span>
    </button>
  );
}

const label: React.CSSProperties = { gridColumn: '1 / -1', fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--il-dim)', marginTop: 4 };

export function TileGrid({ tiles, on, typed, onToggle }: {
  tiles: Tiles; on: Map<string, Part>; typed: string; onToggle: (s: Snippet) => void;
}) {
  const phone = useIsPhone();
  const mode = useTileUi((s) => s.gridMode);
  const setMode = useTileUi((s) => s.setGridMode);
  const editing = useTileEdit((s) => s.editing);
  const draftText = useTileEdit((s) => s.draftText);
  const edit = useTileEdit((s) => s.edit);
  const [query, setQuery] = useState('');
  const list = tiles.positive;

  const auto = useMemo(() => (mode === 'auto' ? relatedTiles(list, typed, tiles.categoryNames) : null), [mode, list, typed, tiles.categoryNames]);
  const found = useMemo(() => (query.trim() ? searchTiles(list, query) : null), [list, query]);
  const groups = useMemo(() => {
    if (found || auto) return null;
    const known = new Set(tiles.categories.map((c) => c.id));
    return tiles.categories
      .map((c) => ({ c, items: list.filter((s) => (known.has(s.categoryId) ? s.categoryId : 'uncategorized') === c.id) }))
      .filter((g) => g.items.length);
  }, [found, auto, list, tiles.categories]);

  const editSnip = editing && editing !== 'new' ? list.find((s) => s.id === editing) : undefined;
  const formOpen = editing === 'new' || !!editSnip;
  const posCats = tiles.categories.filter((c) => !c.id.startsWith('neg-'));
  const h = phone ? 40 : 34;

  const seg = (m: GridMode, text: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      style={{ height: h - 6, padding: '0 10px', border: 0, borderRadius: 8, background: mode === m ? 'var(--il-card-on)' : 'transparent', color: mode === m ? 'var(--il-fg)' : 'var(--il-muted)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{text}</button>
  );

  const shown = found ?? auto?.tiles ?? null;

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: 10 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ flex: 1, minWidth: 0, height: h, borderRadius: 10, background: 'var(--il-bg-deep)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 0 10px' }}>
          <IconSearch size={14} stroke={2.4} style={{ color: 'var(--il-dim)', flex: 'none' }} />
          <input value={query} onChange={(e) => { setQuery(e.target.value); if (e.target.value && mode === 'auto') setMode('manual'); }} placeholder={phone ? 'Search' : 'Search styles & snippets'} aria-label="Search styles and snippets"
            onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ width: 24, height: 24, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.6} /></button>}
        </label>
        <div role="tablist" aria-label="Grid mode" style={{ display: 'inline-flex', height: h, padding: 3, borderRadius: 10, background: 'var(--il-bg-deep)', flex: 'none' }}>
          {seg('manual', 'Manual')}{seg('auto', 'Auto')}
        </div>
        <Button tone="card" h={h} icon={<IconPlus size={15} stroke={2.6} />} tooltip="New tile" on={editing === 'new'} onClick={() => edit(editing === 'new' ? null : 'new')} />
      </div>

      {formOpen && (
        <div style={{ marginBottom: 8 }}>
          <SnippetForm
            key={editing ?? ''}
            initial={editSnip ?? (draftText ? { name: '', text: draftText, categoryId: posCats[0]?.id ?? 'uncategorized' } : undefined)}
            categories={posCats}
            defaultCategory={posCats[0]?.id ?? 'uncategorized'}
            saveLabel={editSnip ? 'Save' : 'Save tile'}
            onCancel={() => edit(null)}
            onSave={(v) => {
              const st = useStore.getState();
              if (editSnip) st.updateSnippet(editSnip.id, editSnip.layers ? { name: v.name, categoryId: v.categoryId } : { name: v.name, text: v.text, categoryId: v.categoryId });
              else st.addSnippet({ name: v.name, text: v.text, kind: 'positive', categoryId: v.categoryId, tag: '', weight: 1 });
              edit(null);
            }}
          />
        </div>
      )}

      {auto && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', margin: '-2px 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>
          {auto.words.length ? <>From your prompt:{auto.words.map((w) => <span key={w} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)' }}>{w}</span>)}</>
            : <span>Type in the prompt — tiles that go with your words show here.</span>}
        </div>
      )}

      <div className="il-scroll" data-no-swipe
        style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(4, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(82px, 1fr))', gap: 8, maxHeight: phone ? 330 : 360, overflowY: 'auto', touchAction: 'pan-y', paddingRight: 2, alignContent: 'start' }}>
        {groups && groups.map((g) => (
          <Fragment key={g.c.id}>
            <div style={label}>{g.c.name}</div>
            {g.items.map((s) => <Tile key={s.id} s={s} part={on.get(s.id)} onToggle={() => onToggle(s)} />)}
          </Fragment>
        ))}
        {shown && shown.map((s) => <Tile key={s.id} s={s} part={on.get(s.id)} onToggle={() => onToggle(s)} />)}
        {shown && shown.length === 0 && (found || typed.trim()) && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '10px 2px' }}>
            {found ? 'No tile matches — try another word, or + to make one.' : 'Nothing related yet — keep typing, or switch to Manual.'}
          </div>
        )}
      </div>
    </div>
  );
}
