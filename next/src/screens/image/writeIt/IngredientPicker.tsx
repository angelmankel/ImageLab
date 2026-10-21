/**
 * Item 37: the studio's ingredient picker — the same style + snippet tiles and fuzzy search as the
 * Prompt tab's grid (L1 #12), in a popover. Opened by "+ Add" (own search box) or by typing "/" in
 * the idea box (the text after "/" is the search; ↑↓ Enter Esc from the box). Tapping a tile tags
 * it on / off as an ingredient. The popover is an overlay, so the modal never scrolls inside itself.
 */
import { useMemo, type ReactNode } from 'react';
import { Popover } from '@mantine/core';
import { IconCheck, IconSearch } from '@tabler/icons-react';
import type { Snippet } from '@/lib/types';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { dvh, vw } from '~/theme/uiScale';
import { searchTiles, tileBackground, tileHue, tileName } from '../prompt/promptSearch';
import '../prompt/smartPrompt.css';

export const PICK_MAX = 60;

/** The tiles shown for a query: ranked matches, or every tile grouped as the library orders them. */
export function usePickerList(tiles: Snippet[], query: string): Snippet[] {
  return useMemo(() => (query.trim() ? searchTiles(tiles, query) : tiles).slice(0, PICK_MAX), [tiles, query]);
}

export function IngredientPicker({ opened, onClose, target, tiles, picked, onToggle, query, onQuery, ownSearch, highlight, categoryNames }: {
  opened: boolean; onClose: () => void; target: ReactNode;
  tiles: Snippet[]; picked: ReadonlySet<string>; onToggle: (s: Snippet) => void;
  query: string; onQuery: (q: string) => void;
  /** true = the popover has its own search box ("+ Add"); false = the idea box's "/" drives it. */
  ownSearch: boolean;
  highlight: number;
  categoryNames: Record<string, string>;
}) {
  const phone = useIsPhone();
  const list = usePickerList(tiles, query);
  return (
    <Popover opened={opened} onChange={(o) => { if (!o) onClose(); }} position="bottom-start" shadow="lg" withinPortal zIndex={T.z.popover}
      trapFocus={ownSearch} returnFocus={ownSearch} closeOnEscape classNames={{ dropdown: 'il-dd il-pop-in' }} middlewares={{ flip: true, shift: true }}>
      <Popover.Target>{target}</Popover.Target>
      <Popover.Dropdown style={{ width: phone ? `calc(${vw(100)} - 24px)` : 380, padding: 10 }} onMouseDown={(e) => { if (!ownSearch) e.preventDefault(); }}>
        {ownSearch ? (
          <label style={{ height: phone ? 40 : 34, borderRadius: 10, background: 'var(--il-bg-deep)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginBottom: 8 }}>
            <IconSearch size={14} stroke={2.4} style={{ color: 'var(--il-dim)', flex: 'none' }} />
            <input autoFocus value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search styles & snippets" aria-label="Search styles and snippets"
              onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); onToggle(list[0]); } }}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
          </label>
        ) : (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', marginBottom: 8 }}>
            {query ? <>Matching “{query}” · ↑↓ Enter</> : 'Type to search · ↑↓ Enter · Esc'}
          </div>
        )}
        <div className="il-scroll" data-no-swipe style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, maxHeight: phone ? dvh(50) : 320, overflowY: 'auto', touchAction: 'pan-y', alignContent: 'start' }}>
          {list.map((s, i) => {
            const on = picked.has(s.id);
            return (
              <button key={s.id} type="button" className={`il-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onToggle(s)}
                title={`${s.name} · ${categoryNames[s.categoryId] ?? ''}\n${s.layers ? s.layers.map((l) => l.text).join(' · ') : s.text}`}
                style={{ background: tileBackground(tileHue(s)), outline: !ownSearch && i === highlight ? '2px solid var(--il-fg)' : undefined, outlineOffset: 2 }}>
                {on && <span className="il-tile-check" aria-hidden><IconCheck size={12} stroke={3.2} /></span>}
                <span className="il-tile-name">{tileName(s.name)}</span>
              </button>
            );
          })}
          {!list.length && <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', padding: '10px 2px' }}>No tile matches.</div>}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
