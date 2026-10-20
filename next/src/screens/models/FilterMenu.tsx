/**
 * The labelled dropdown chip of the desktop filter bar ("Type: Checkpoint ▾", "Base: SDXL +2 ▾")
 * and the pieces its menu is made of: a 36-high pill, ember when the filter is not at its default,
 * that opens a small Mantine popover above the Models modal (T.z.popover). Outside click and
 * Escape close it — and only it: the modal closes on any Escape whose target lacks
 * `data-mantine-stop-propagation`, so the open chip, its menu and everything focused inside carry it.
 */
import { useState, type ReactNode } from 'react';
import { Popover } from '@mantine/core';
import { IconCheck, IconChevronDown, IconLock } from '@tabler/icons-react';
import { T } from '~/theme/tokens';

const STOP = 'data-mantine-stop-propagation';

export function FilterMenu({ label, value, on, locked, width = 260, title, children }: {
  label: string; value?: string; on?: boolean; locked?: boolean; width?: number; title?: string; children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const lit = on || opened;
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" offset={6} shadow="lg" width={width} withinPortal zIndex={T.z.popover} closeOnEscape closeOnClickOutside>
      <Popover.Target>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={opened}
          title={title}
          {...{ [STOP]: opened ? 'true' : undefined }}
          onClick={(e) => { e.currentTarget.focus(); setOpened((o) => !o); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && opened) { e.preventDefault(); setOpened(false); } }}
          style={{
            height: 36, padding: '0 10px 0 13px', flex: 'none', borderRadius: T.radius.pill, cursor: 'pointer',
            border: `1px solid ${lit ? 'var(--il-ember)' : 'var(--il-line-strong)'}`,
            background: on ? 'var(--il-ember-soft)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', gap: T.gap.sm, whiteSpace: 'nowrap', fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 700, color: on ? 'var(--il-ember)' : 'var(--il-muted)' }}>{label}{value ? ':' : ''}</span>
          {value && <span style={{ fontWeight: 800, color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>}
          {locked && <IconLock size={12} stroke={2.4} style={{ color: 'var(--il-ember)' }} />}
          <IconChevronDown size={13} stroke={2.6} style={{ color: 'var(--il-muted)', transform: opened ? 'rotate(180deg)' : undefined, transition: 'transform .12s' }} />
        </button>
      </Popover.Target>
      <Popover.Dropdown
        tabIndex={-1}
        {...{ [STOP]: 'true' }}
        onFocusCapture={(e) => (e.target as HTMLElement).setAttribute?.(STOP, 'true')}
        // A click that would leave focus nowhere (Safari never focuses a clicked button) parks it on the
        // menu, so Escape still reaches the popover instead of the modal behind it.
        onPointerDownCapture={(e) => { if (!(e.target as HTMLElement).closest('input, textarea, select')) e.currentTarget.focus({ preventScroll: true }); }}
        style={{ outline: 'none', background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.lg, padding: T.gap.sm, color: 'var(--il-fg)' }}
      >
        {children}
      </Popover.Dropdown>
    </Popover>
  );
}

/** A menu's header line: "TYPE" … "Clear". */
export function MenuHead({ children, onClear }: { children: ReactNode; onClear?: () => void }) {
  return (
    <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', gap: T.gap.md }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: 'var(--il-muted)' }}>{children}</span>
      {onClear && <button type="button" onClick={onClear} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 11, fontWeight: 700, padding: 0, cursor: 'pointer' }}>Clear</button>}
    </div>
  );
}

/** A hairline between a menu's sections. */
export function MenuSep() {
  return <div aria-hidden style={{ height: 1, background: 'var(--il-line)', margin: `${T.gap.xs}px ${T.gap.xs}px` }} />;
}

/** One checkbox row: a square box (ember with a tick when on), the label, an optional hint under it. */
export function CheckRow({ label, on, onChange, hint, disabled, trailing }: {
  label: ReactNode; on: boolean; onChange?: (on: boolean) => void; hint?: string; disabled?: boolean; trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--il-elev)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      style={{
        width: '100%', minHeight: 32, padding: '5px 8px', border: 0, borderRadius: T.radius.xs, background: 'transparent',
        display: 'flex', alignItems: 'center', gap: T.gap.md, textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
        color: 'var(--il-fg)', opacity: disabled ? 0.75 : 1,
      }}
    >
      <span aria-hidden style={{
        width: 16, height: 16, flex: 'none', borderRadius: 5, display: 'grid', placeItems: 'center',
        background: on ? 'var(--il-ember)' : 'transparent', border: on ? 0 : '1.5px solid var(--il-line-strong)', color: 'var(--il-bg)',
      }}>{on && <IconCheck size={11} stroke={3.4} />}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span style={{ fontSize: 12, fontWeight: on ? 800 : 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--il-muted)' }}>{hint}</span>}
      </span>
      {trailing}
    </button>
  );
}

/** Check rows in `cols` columns (the Type and Base lists). */
export function CheckGrid({ cols = 2, children }: { cols?: number; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 1 }}>{children}</div>;
}
