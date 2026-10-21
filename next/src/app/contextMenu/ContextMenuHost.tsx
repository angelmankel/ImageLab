/**
 * Renders the open right-click menu (FIXLIST 45) and owns the app-wide listeners: the browser's
 * own menu is replaced everywhere except text fields and Shift + right-click; a right-click on
 * something with no registered menu gets the fallback types ('link', 'image', 'app' —
 * ./builtinMenus); a phone long-press on a `menuProps` element opens its menu (elsewhere the
 * phone keeps its own long-press; `data-no-ctx` opts a hold gesture out). Mounted once in App.
 *
 * Look: our menus' face (Mantine Menu in the Ember theme): elev panel, strong hairline, 12 radius,
 * 13px / 600 rows, card-on highlight. Rows are 32px on desktop, 44px on a phone.
 * Keys: ↑ ↓ Home End · → opens a submenu, ← / Esc closes it · Enter / Space runs · letters jump · Tab closes.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { toCssPx, vh } from '~/theme/uiScale';
import { useIsPhone } from '~/app/useIsPhone';
import {
  firstIndex, isTextField, lastIndex, letterIndex, placeAtPoint, placeBeside, stepIndex, type MenuRow,
} from './menuLogic';
import { closeMenu, handledEvents, openMenu, pointOf, touchClock, useContextMenu, type OpenMenu } from './registry';
import { fallbackTarget } from './builtinMenus';
import './menus';

const Z = T.z.confirm + 50; // above popovers, modals and the confirm layer
const LONG_PRESS_MS = 500;
const MOVE_PX = 10;

/* ---------------- global listeners ---------------- */

function useGlobalMenuListeners() {
  useEffect(() => {
    let press: { timer: number; x: number; y: number; target: Element } | null = null;
    let suppressClickUntil = 0;
    let syntheticAt = 0;
    let touchAt = 0;

    // Capture, before React: Android fires its own contextmenu on a long-press; whichever of it and
    // our timer comes first wins and the other is dropped, so the menu opens once.
    const onCapture = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      if (press) { clearTimeout(press.timer); press = null; suppressClickUntil = Date.now() + 800; return; }
      if (Date.now() - syntheticAt < 800) { e.preventDefault(); e.stopPropagation(); }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented || handledEvents.has(e) || e.shiftKey) return;
      const t = e.target as Element | null;
      if (!t || isTextField(t)) return;
      // A long-press on a phone on something without a menu of ours keeps the system's behaviour.
      if (e.isTrusted && Date.now() - touchAt < 1500) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim() && sel.containsNode(t, true)) return; // copy selected text
      e.preventDefault();
      const fb = fallbackTarget(t);
      const p = pointOf(e, fb.el);
      openMenu(fb.type, fb.target, p, { el: fb.el, keyboard: p.keyboard });
    };

    const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
    const onTouchStart = (e: TouchEvent) => {
      cancelPress();
      touchAt = Date.now();
      touchClock.at = touchAt;
      if (e.touches.length !== 1) return;
      const t = e.target as Element | null;
      // Only things with a registered menu; text fields and own hold gestures keep theirs.
      if (!t || isTextField(t) || !t.closest('[data-ctx]') || t.closest('[data-no-ctx]')) return;
      const { clientX: x, clientY: y } = e.touches[0];
      press = {
        x, y, target: t,
        timer: window.setTimeout(() => {
          if (!press) return;
          const target = press.target;
          press = null;
          if (!document.contains(target)) return;
          const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
          target.dispatchEvent(ev);
          if (ev.defaultPrevented) {
            syntheticAt = Date.now();
            suppressClickUntil = syntheticAt + 800;
            try { navigator.vibrate?.(8); } catch { /* not supported */ }
          }
        }, LONG_PRESS_MS),
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!press) return;
      const t = e.touches[0];
      if (!t || Math.hypot(t.clientX - press.x, t.clientY - press.y) > MOVE_PX) cancelPress();
    };
    // The click that follows a long-press must not also tap the thing.
    const onClick = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil && !(e.target as Element)?.closest?.('[data-il-ctxmenu]')) {
        suppressClickUntil = 0;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('contextmenu', onCapture, true);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', cancelPress, { passive: true });
    document.addEventListener('touchcancel', cancelPress, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      cancelPress();
      window.removeEventListener('contextmenu', onCapture, true);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', cancelPress);
      document.removeEventListener('touchcancel', cancelPress);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}

/* ---------------- rendering ---------------- */

type Anchor = { x: number; y: number } | { left: number; right: number; top: number };
interface Level { rows: MenuRow[]; active: number; anchor: Anchor; parent?: number }

function Panel({ level, depth, phone, onHover, onActivate }: {
  level: Level; depth: number; phone: boolean;
  onHover: (depth: number, i: number, el: HTMLElement) => void;
  onActivate: (depth: number, i: number, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const vw = window.innerWidth; const vh = window.innerHeight;
    const a = level.anchor;
    setPos('x' in a ? placeAtPoint(a.x, a.y, w, h, vw, vh) : placeBeside(a, w, h, vw, vh));
  }, [level.anchor, level.rows]);

  const style: CSSProperties = {
    // pos is in window px (rects / clientX); the menu sits in the zoomed body, so convert (item 4).
    position: 'fixed', left: toCssPx(pos?.left ?? 0), top: toCssPx(pos?.top ?? 0), visibility: pos ? 'visible' : 'hidden',
    zIndex: Z + depth, minWidth: phone ? 220 : 196, maxWidth: 320, maxHeight: `calc(${vh(100)} - 16px)`,
    padding: 4, background: 'var(--il-elev)', border: '1px solid var(--il-line-strong)', borderRadius: T.radius.md,
    boxShadow: '0 12px 32px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3)', fontFamily: 'var(--il-font)',
    overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', userSelect: 'none',
  };
  return (
    <div ref={ref} role="menu" data-il-ctxmenu="" data-depth={depth} style={style} className="il-scroll"
      onContextMenu={(e) => e.preventDefault()}>
      {level.rows.map((r, i) => r.kind === 'sep'
        ? <div key={r.key} role="separator" style={{ height: 1, margin: '4px 6px', background: 'var(--il-line-strong)' }} />
        : <Item key={r.key} row={r} active={level.active === i} phone={phone} depth={depth} index={i}
            onHover={(el) => onHover(depth, i, el)} onActivate={(el) => onActivate(depth, i, el)} />)}
    </div>
  );
}

function Item({ row, active, phone, depth, index, onHover, onActivate }: {
  row: Extract<MenuRow, { kind: 'item' }>; active: boolean; phone: boolean; depth: number; index: number;
  onHover: (el: HTMLElement) => void; onActivate: (el: HTMLElement) => void;
}) {
  const Icon = row.entry.icon;
  const color = row.disabled ? 'var(--il-dim)' : row.entry.danger ? 'var(--il-err)' : 'var(--il-fg)';
  return (
    <div
      role={row.checked ? 'menuitemcheckbox' : 'menuitem'} aria-checked={row.checked || undefined}
      aria-disabled={row.disabled || undefined} aria-haspopup={row.children ? 'menu' : undefined}
      data-depth={depth} data-idx={index} title={row.reason}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') onHover(e.currentTarget); }}
      onClick={(e) => { e.stopPropagation(); if (!row.disabled) onActivate(e.currentTarget); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: phone ? 44 : 32, padding: '0 10px',
        borderRadius: T.radius.xs, cursor: row.disabled ? 'default' : 'pointer', color,
        background: active && !row.disabled ? 'var(--il-card-on)' : 'transparent',
        fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 16, flex: 'none', display: 'grid', placeItems: 'center', color: row.entry.danger && !row.disabled ? 'var(--il-err)' : row.disabled ? 'var(--il-dim)' : 'var(--il-muted)' }}>
        {row.checked ? <IconCheck size={15} stroke={2.4} color="var(--il-ember)" /> : Icon ? <Icon size={15} stroke={2} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
      {row.entry.shortcut && !phone && (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)', marginLeft: 12 }}>{row.entry.shortcut}</span>
      )}
      {row.children && <IconChevronRight size={14} stroke={2.2} style={{ color: 'var(--il-muted)', marginRight: -4 }} />}
    </div>
  );
}

function rectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top };
}

function MenuRoot({ menu, phone }: { menu: OpenMenu; phone: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [levels, setLevels] = useState<Level[]>(() => [{
    rows: menu.rows, active: menu.keyboard ? firstIndex(menu.rows) : -1, anchor: { x: menu.ctx.x, y: menu.ctx.y },
  }]);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const hoverTimer = useRef(0);

  const itemEl = (d: number, i: number) =>
    rootRef.current?.querySelector<HTMLElement>(`[role^="menuitem"][data-depth="${d}"][data-idx="${i}"]`) ?? null;

  const run = (row: Extract<MenuRow, { kind: 'item' }>) => {
    closeMenu();
    try {
      const r = row.entry.action?.(menu.target, menu.ctx);
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch((err) => console.error('[menu]', err));
    } catch (err) { console.error('[menu]', err); }
  };

  const openSub = (d: number, i: number, el: HTMLElement | null, focusFirst: boolean) => {
    setLevels((ls) => {
      const row = ls[d]?.rows[i];
      if (!row || row.kind !== 'item' || !row.children || !el) return ls;
      const kept = ls.slice(0, d + 1).map((l, k) => (k === d ? { ...l, active: i } : l));
      return [...kept, { rows: row.children, active: focusFirst ? firstIndex(row.children) : -1, anchor: rectOf(el), parent: i }];
    });
  };

  // Hover highlights at once; opening / closing a submenu waits a beat, so a diagonal move into
  // an open submenu does not close it on the way.
  const onHover = (d: number, i: number, el: HTMLElement) => {
    clearTimeout(hoverTimer.current);
    setLevels((ls) => ls.map((l, k) => {
      if (k === d) return { ...l, active: i };
      if (k < d) return { ...l, active: ls[k + 1]?.parent ?? l.active };
      return l;
    }));
    const row = levelsRef.current[d]?.rows[i];
    const opensSub = !!row && row.kind === 'item' && !!row.children && !row.disabled;
    if (opensSub && levelsRef.current[d + 1]?.parent === i) return; // already open
    hoverTimer.current = window.setTimeout(() => {
      if (opensSub) openSub(d, i, el, false);
      else setLevels((ls) => ls.slice(0, d + 1));
    }, 130);
  };

  const onActivate = (d: number, i: number, el: HTMLElement) => {
    const row = levelsRef.current[d]?.rows[i];
    if (!row || row.kind !== 'item' || row.disabled) return;
    if (row.children) openSub(d, i, el, false);
    else run(row);
  };

  // Focus the menu so the keys come here; close on anything outside it.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const outside = (e: Event) => !(e.target as Element)?.closest?.('[data-il-ctxmenu]');
    const onDown = (e: PointerEvent) => { if (outside(e)) closeMenu(); };
    const onScroll = (e: Event) => { if (outside(e)) closeMenu(); };
    const onBlur = () => closeMenu();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('wheel', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onBlur);
    window.addEventListener('blur', onBlur);
    window.addEventListener('hashchange', onBlur);
    return () => {
      clearTimeout(hoverTimer.current);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('wheel', onScroll, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onBlur);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('hashchange', onBlur);
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const ls = levelsRef.current;
    const d = ls.length - 1;
    const lv = ls[d];
    const setActive = (i: number) => setLevels((cur) => cur.map((l, k) => (k === d ? { ...l, active: i } : l)));
    const k = e.key;
    let handled = true;
    if (k === 'ArrowDown') setActive(stepIndex(lv.rows, lv.active, 1));
    else if (k === 'ArrowUp') setActive(stepIndex(lv.rows, lv.active, -1));
    else if (k === 'Home') setActive(firstIndex(lv.rows));
    else if (k === 'End') setActive(lastIndex(lv.rows));
    else if (k === 'ArrowRight') {
      const row = lv.rows[lv.active];
      if (row?.kind === 'item' && row.children && !row.disabled) openSub(d, lv.active, itemEl(d, lv.active), true);
    } else if (k === 'ArrowLeft') { if (d > 0) setLevels(ls.slice(0, d)); }
    else if (k === 'Escape') { if (d > 0) setLevels(ls.slice(0, d)); else closeMenu(); }
    else if (k === 'Enter' || k === ' ') {
      const row = lv.rows[lv.active];
      if (row?.kind === 'item' && !row.disabled) {
        if (row.children) openSub(d, lv.active, itemEl(d, lv.active), true);
        else run(row);
      }
    } else if (k === 'Tab') closeMenu();
    else if (k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = letterIndex(lv.rows, lv.active, k);
      if (i >= 0) setActive(i);
    } else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };

  return (
    <div ref={rootRef} tabIndex={-1} data-il-ctxmenu="" onKeyDown={onKeyDown} aria-label="Context menu"
      style={{ position: 'fixed', inset: 0, width: 0, height: 0, outline: 'none', zIndex: Z }}>
      {levels.map((lv, d) => (
        <Panel key={d} level={lv} depth={d} phone={phone} onHover={onHover} onActivate={onActivate} />
      ))}
    </div>
  );
}

const CSS = `[data-ctx]{-webkit-touch-callout:none}`;

export function ContextMenuHost() {
  useGlobalMenuListeners();
  const menu = useContextMenu((s) => s.menu);
  const phone = useIsPhone();
  return (
    <>
      <style>{CSS}</style>
      {menu && createPortal(<MenuRoot key={menu.seq} menu={menu} phone={phone} />, document.body)}
    </>
  );
}
