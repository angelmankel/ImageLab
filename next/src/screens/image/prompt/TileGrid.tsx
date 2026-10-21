/**
 * Item 12: styles + snippets as ONE scrollable grid of square tiles, with a search box on top.
 * Manual: search, tap a tile to put it in / take it out of the prompt (the text itself — a tile is
 * on when its text is in the prompt). Auto: the words typed in the prompt pick the related tiles.
 * The name sits inside the tile (capped to fit); the picture is the tile's colour until it has
 * art (or its own picture, item 42). Right-click / long-press a tile: the 'style-tile' menu; a
 * category title: the 'snippet-category' menu (`snippets/snippetMenus`). "+" opens the quick
 * snippet modal, ⚙ the Manage window (item 42).
 */
import { Fragment, useMemo, useState } from 'react';
import { IconCheck, IconPlus, IconSearch, IconSettings, IconX } from '@tabler/icons-react';
import type { Snippet } from '@/lib/types';
import { menuProps } from '~/app/contextMenu';
import { useIsPhone } from '~/app/useIsPhone';
import { Button } from '~/ui';
import '../snippets/snippetMenus';
import { formatWeight, type Part } from './promptSections';
import { relatedTiles, searchTiles, tileBackground, tileHue, tileName } from './promptSearch';
import { useTileEdit, useTileUi, type GridMode } from './tileStore';
import type { Tiles } from './useTiles';

function Tile({ s, part, onToggle }: { s: Snippet; part: Part | undefined; onToggle: () => void }) {
  const on = !!part;
  const text = s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text;
  return (
    <button type="button" className={`il-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onToggle} title={`${s.name}\n${text}`}
      style={{ background: s.image ? `center / cover no-repeat url("${s.image}")` : tileBackground(tileHue(s)) }} {...menuProps('style-tile', s)}>
      {on && <span className="il-tile-check" aria-hidden><IconCheck size={12} stroke={3.2} /></span>}
      {part && Math.abs(part.weight - 1) > 0.001 && <span className="il-tile-w">{formatWeight(part.weight)}</span>}
      <span className="il-tile-name">{tileName(s.name)}</span>
    </button>
  );
}

const label: React.CSSProperties = { gridColumn: '1 / -1', fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--il-dim)', marginTop: 4 };

export function TileGrid({ tiles, on, typed, onToggle, flow = false, onlyOn = false }: {
  tiles: Tiles; on: Map<string, Part>; typed: string; onToggle: (s: Snippet) => void;
  /** Items 6 / 43: no scroll of its own — the grid flows in the panel's one scroll (Prompt tab). */
  flow?: boolean;
  /** Item 47: show only the tiles that are on (each a tap away from off). */
  onlyOn?: boolean;
}) {
  const phone = useIsPhone();
  const mode = useTileUi((s) => s.gridMode);
  const setMode = useTileUi((s) => s.setGridMode);
  const edit = useTileEdit((s) => s.edit);
  const openManage = useTileEdit((s) => s.openManage);
  const [query, setQuery] = useState('');
  const all = tiles.positive;
  const list = useMemo(() => (onlyOn ? all.filter((s) => on.has(s.id)) : all), [onlyOn, all, on]);

  const auto = useMemo(() => (mode === 'auto' && !onlyOn ? relatedTiles(list, typed, tiles.categoryNames) : null), [mode, onlyOn, list, typed, tiles.categoryNames]);
  const found = useMemo(() => (query.trim() ? searchTiles(list, query) : null), [list, query]);
  const groups = useMemo(() => {
    if (found || auto) return null;
    const known = new Set(tiles.categories.map((c) => c.id));
    return tiles.categories
      .map((c) => ({ c, items: list.filter((s) => (known.has(s.categoryId) ? s.categoryId : 'uncategorized') === c.id) }))
      .filter((g) => g.items.length);
  }, [found, auto, list, tiles.categories]);

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
        <Button tone="card" h={h} icon={<IconSettings size={15} stroke={2.2} />} tooltip="Manage snippets" onClick={() => openManage('')} />
        <Button tone="card" h={h} icon={<IconPlus size={15} stroke={2.6} />} tooltip="New snippet" onClick={() => edit('new')} />
      </div>

      {auto && !typed.trim() && !onlyOn && (
        <div style={{ margin: '-2px 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>Type in the prompt — tiles that go with your words show here.</div>
      )}

      <div className={flow ? undefined : 'il-scroll'} data-no-swipe
        style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(4, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(82px, 1fr))', gap: 8, ...(flow ? {} : { maxHeight: phone ? 330 : 360, overflowY: 'auto' as const, touchAction: 'pan-y', paddingRight: 2 }), alignContent: 'start' }}>
        {groups && groups.map((g) => (
          <Fragment key={g.c.id}>
            <div style={label} {...menuProps('snippet-category', g.c)}>{g.c.icon ? `${g.c.icon} ` : ''}{g.c.name}</div>
            {g.items.map((s) => <Tile key={s.id} s={s} part={on.get(s.id)} onToggle={() => onToggle(s)} />)}
          </Fragment>
        ))}
        {shown && shown.map((s) => <Tile key={s.id} s={s} part={on.get(s.id)} onToggle={() => onToggle(s)} />)}
        {onlyOn && list.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '10px 2px' }}>No tile is on yet — turn off "On only" and tap one.</div>
        )}
        {!onlyOn && shown && shown.length === 0 && (found || typed.trim()) && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '10px 2px' }}>
            {found ? 'No tile matches — try another word, or + to make one.' : 'Nothing related yet — keep typing, or switch to Manual.'}
          </div>
        )}
      </div>
    </div>
  );
}
