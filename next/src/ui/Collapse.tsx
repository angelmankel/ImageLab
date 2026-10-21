/**
 * THE collapse (FIXLIST-2 item 7): a low-profile section header — a small chevron + an uppercase
 * label, no box, no filled bar — that folds the body under it. One for every panel section
 * (Prompt, Styles & snippets, Composition, Model, Parameters, Settings…).
 *
 *   <Collapse id="prompt.box" label="Prompt" preview={oneLine}>…</Collapse>
 *
 * - Click the label or the chevron to toggle (the whole row is one button, ≥ 40px on the phone).
 * - `id` = remembered per viewer (this browser, `imagelab.next.collapse.v1`); without `id` it is
 *   local state. Or drive it yourself with `open` + `onOpenChange`.
 * - `preview` shows after the label while folded (e.g. the prompt's first line), `extra` always.
 * - `right` sits at the far end and never toggles (a count, a menu, a button).
 * - `onReset` adds a small ↺ "Reset section" at the right while open (item 8's section reset);
 *   `resetDisabled` greys it (e.g. nothing differs from the defaults).
 * - Open / close is a quick height animation that follows the theme's motion setting.
 * `CollapseHeader` is the header alone, for a caller that renders its own body.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Collapse as MCollapse } from '@mantine/core';
import { IconChevronDown, IconRestore } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { dur, motionScale } from '~/theme/motion';
import { Tip } from './Tip';
import { useCollapseStore } from './collapseStore';

export interface CollapseHeaderProps {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  /** After the label, inside the toggle (a badge, a summary). */
  extra?: ReactNode;
  /** After the label while folded only: a one-line preview of what is inside. */
  preview?: ReactNode;
  /** Far right, outside the toggle. */
  right?: ReactNode;
  /** Shows a ↺ "Reset section" at the right while open. */
  onReset?: () => void;
  resetDisabled?: boolean;
  /** Label colour (defaults to muted). */
  tone?: string;
  style?: CSSProperties;
}

export function CollapseHeader({ open, onToggle, label, extra, preview, right, onReset, resetDisabled, tone, style }: CollapseHeaderProps) {
  const phone = useIsPhone();
  const h = phone ? 40 : 26;
  return (
    <div className="il-collapse-head" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: h, ...style }}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{ flex: 1, minWidth: 0, minHeight: h, display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', border: 0, background: 'transparent', cursor: 'pointer', color: tone ?? 'var(--il-muted)', font: 'inherit', textAlign: 'left' }}>
        <IconChevronDown size={14} stroke={2.6} aria-hidden
          style={{ flex: 'none', transform: open ? 'none' : 'rotate(-90deg)', transition: `transform ${dur(0.15)} ease` }} />
        <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase' }}>{label}</span>
        {extra}
        {!open && preview != null && (
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--il-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
        )}
      </button>
      {open && onReset && (
        <Tip label="Reset section">
          <button type="button" aria-label="Reset section" onClick={onReset} disabled={resetDisabled} className="il-reset"
            style={{ flex: 'none', width: phone ? 40 : 24, height: phone ? 40 : 24, display: 'grid', placeItems: 'center', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', cursor: resetDisabled ? 'default' : 'pointer', opacity: resetDisabled ? 0.35 : 1 }}>
            <IconRestore size={13} stroke={2.2} />
          </button>
        </Tip>
      )}
      {right}
    </div>
  );
}

export interface CollapseProps extends Omit<CollapseHeaderProps, 'open' | 'onToggle'> {
  /** Remember the state per viewer under this key. */
  id?: string;
  defaultOpen?: boolean;
  /** Controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Gap between the header and the body (default 6). */
  gap?: number;
  /** Style of the outer wrapper. */
  wrapStyle?: CSSProperties;
  /** Style of the header row. */
  headerStyle?: CSSProperties;
}

export function Collapse({ id, defaultOpen = true, open: controlled, onOpenChange, children, gap = 6, wrapStyle, headerStyle, style, ...head }: CollapseProps) {
  const [local, setLocal] = useState(defaultOpen);
  const stored = useCollapseStore((s) => (id ? s.open[id] : undefined));
  const setStored = useCollapseStore((s) => s.set);
  const open = controlled ?? (id ? stored ?? defaultOpen : local);
  const toggle = () => {
    const next = !open;
    if (controlled === undefined) { if (id) setStored(id, next); else setLocal(next); }
    onOpenChange?.(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...wrapStyle }}>
      <CollapseHeader {...head} open={open} onToggle={toggle} style={{ ...style, ...headerStyle }} />
      <MCollapse in={open} transitionDuration={Math.round(160 * motionScale())} transitionTimingFunction="ease">
        <div style={{ paddingTop: gap }}>{children}</div>
      </MCollapse>
    </div>
  );
}
