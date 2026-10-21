/**
 * Item 12: under the box in Negative mode — the simple look Donny kept for negatives: category
 * pills (one at a time, remembered) and the snippet pills of that category. A pill is on when its
 * text is in the negative prompt; a tap puts it in / takes it out. + = the quick snippet modal (item 42).
 * Right-click / long-press a pill: Edit · Delete · Copy (the 'style-tile' menu). No model-specific
 * entries (Pony, Illustrious): `useTiles` leaves them out.
 */
import { useCallback, useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import type { Snippet } from '@/lib/types';
import { menuProps } from '~/app/contextMenu';
import { useIsPhone } from '~/app/useIsPhone';
import { useEdgeFade, useWheelSideways } from '~/ui';
import '../snippets/snippetMenus';
import { categoriesWith, inCategory, pickTab } from '../snippets/snippetLogic';
import { useSnippetsUi } from '../snippets/snippetsStore';
import { formatWeight, type Part } from './promptSections';
import { useTileEdit } from './tileStore';
import type { Tiles } from './useTiles';

export function NegativePills({ tiles, on, onToggle }: { tiles: Tiles; on: Map<string, Part>; onToggle: (s: Snippet) => void }) {
  const phone = useIsPhone();
  const saved = useSnippetsUi((s) => s.tab.negative);
  const setTab = useSnippetsUi((s) => s.setTab);
  const edit = useTileEdit((s) => s.edit);
  const wheelRef = useWheelSideways<HTMLDivElement>();
  const fade = useEdgeFade<HTMLDivElement>();
  const catsRef = useCallback((el: HTMLDivElement | null) => { wheelRef(el); fade.ref(el); }, [wheelRef, fade.ref]);

  const list = tiles.negative;
  const cats = useMemo(() => categoriesWith(tiles.categories, list), [tiles.categories, list]);
  const tab = pickTab(saved, cats);
  const pills = useMemo(() => inCategory(list, tiles.categories, tab), [list, tiles.categories, tab]);
  const h = phone ? 36 : 26;

  return (
    <div style={{ background: 'var(--il-card)', borderRadius: 16, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div ref={catsRef} role="tablist" aria-label="Negative snippet categories" className="il-scroll-x" data-no-swipe style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, touchAction: 'pan-x pan-y', ...fade.style }}>
          {cats.map((c) => {
            const sel = c.id === tab;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={sel} onClick={() => setTab('negative', c.id)} {...menuProps('snippet-category', c)}
                style={{ height: h, padding: '0 10px', border: 0, borderRadius: 999, background: sel ? 'var(--il-fg)' : 'transparent', color: sel ? 'var(--il-bg)' : 'var(--il-muted)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>
                {tiles.categoryNames[c.id] ?? c.name}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => edit('new-neg', '', tab)} aria-label="New negative snippet" title="New negative snippet"
          style={{ width: h, height: h, border: 0, borderRadius: '50%', background: 'var(--il-card-on)', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
          <IconPlus size={14} stroke={2.6} />
        </button>
      </div>

      {pills.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pills.map((s) => {
            const part = on.get(s.id);
            const lit = !!part;
            return (
              <button key={s.id} type="button" aria-pressed={lit} onClick={() => onToggle(s)} title={s.text} {...menuProps('style-tile', s)}
                style={{
                  height: phone ? 36 : 28, padding: '0 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: `1px solid ${lit ? 'color-mix(in srgb, var(--il-err) 45%, transparent)' : 'var(--il-line-soft)'}`,
                  background: lit ? 'color-mix(in srgb, var(--il-err) 16%, var(--il-card))' : 'var(--il-elev)',
                  color: lit ? 'color-mix(in srgb, var(--il-err) 70%, white)' : 'var(--il-fg2)',
                }}>
                {s.name}
                {part && Math.abs(part.weight - 1) > 0.001 && <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.85 }}>{formatWeight(part.weight)}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-dim)', padding: '4px 2px' }}>No negative snippets yet — tap +.</div>
      )}
    </div>
  );
}
