/**
 * The right-click / long-press menu on a phone (mobile pass, m-shell; Donny 10-21: "menus come from
 * the bottom"): the same registered entries (`~/app/contextMenu`), the same order and groups, as a
 * bottom sheet with 48 px rows. A submenu opens inside the sheet (‹ back to the parent rows).
 * Pull down, tap outside or Esc closes. Used by ContextMenuHost when the phone shell is on.
 */
import { useState } from 'react';
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { MenuRow } from '~/app/contextMenu/menuLogic';
import { closeMenu, type OpenMenu } from '~/app/contextMenu/registry';
import { T } from '~/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { haptic } from './haptic';

type Item = Extract<MenuRow, { kind: 'item' }>;

export function MenuSheet({ menu, zIndex }: { menu: OpenMenu; zIndex: number }) {
  const [path, setPath] = useState<Item[]>([]);
  const rows = path.length ? path[path.length - 1].children ?? [] : menu.rows;

  const run = (row: Item) => {
    if (row.disabled) return;
    if (row.children) { setPath((p) => [...p, row]); return; }
    haptic('tick');
    closeMenu();
    try {
      const r = row.entry.action?.(menu.target, menu.ctx);
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch((err) => console.error('[menu]', err));
    } catch (err) { console.error('[menu]', err); }
  };

  return (
    <BottomSheet opened onClose={closeMenu} zIndex={zIndex} aria-label="Menu" bodyPadding={6}
      title={path.length ? (
        <button type="button" onClick={() => setPath((p) => p.slice(0, -1))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 40, padding: '0 8px 0 0', border: 0, background: 'transparent', color: 'var(--il-fg)', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          <IconChevronLeft size={18} stroke={2.6} />{path[path.length - 1].label}
        </button>
      ) : undefined}
      withClose={false}>
      <div role="menu" data-il-ctxmenu="" onContextMenu={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => {
          if (r.kind === 'sep') return <div key={r.key} role="separator" style={{ height: 1, margin: '4px 10px', background: 'var(--il-line)' }} />;
          const Icon = r.entry.icon;
          const color = r.disabled ? 'var(--il-dim)' : r.entry.danger ? 'var(--il-err)' : 'var(--il-fg)';
          return (
            <button key={r.key} type="button" role={r.checked ? 'menuitemcheckbox' : 'menuitem'} aria-checked={r.checked || undefined}
              aria-disabled={r.disabled || undefined} onClick={() => run(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: '0 12px', border: 0, borderRadius: T.radius.md, background: 'transparent', color, font: 'inherit', fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: r.disabled ? 'default' : 'pointer' }}>
              <span aria-hidden style={{ width: 20, flex: 'none', display: 'grid', placeItems: 'center', color: r.entry.danger && !r.disabled ? 'var(--il-err)' : r.disabled ? 'var(--il-dim)' : 'var(--il-muted)' }}>
                {r.checked ? <IconCheck size={18} stroke={2.4} color="var(--il-ember)" /> : Icon ? <Icon size={18} stroke={2} /> : null}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                {r.disabled && r.reason && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--il-dim)' }}>{r.reason}</span>}
              </span>
              {r.children && <IconChevronRight size={16} stroke={2.2} color="var(--il-muted)" />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
