/**
 * One folding section: icon, name and live summary on the header, the controls under it. The
 * desktop stacks these in a column; the phone shows the same sections as `SettingsPager` rows.
 */
import type { ReactNode } from 'react';
import { Collapse } from '@mantine/core';
import { IconChevronDown, type Icon as TablerIcon } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { StatusBadge, type PagerStatus } from '@/components/SettingsPager';

export function SectionCard({ id, title, icon: Icon, status, open, onToggle, actions, children }: {
  id?: string;
  title: string;
  icon: TablerIcon;
  status: PagerStatus;
  open: boolean;
  onToggle: () => void;
  /** Controls on the header's right, before the chevron. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const warn = status.tone === 'warn';
  return (
    // `shrink-0`: a flex child shrinks by default and would clip its own controls.
    <section id={id} aria-label={title} className="shrink-0 rounded-lg border border-border-default bg-bg-panel">
      <div className="flex min-h-10 items-center gap-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} title={status.note}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-bg-elev focus-visible:ring-1 focus-visible:ring-accent">
          <Icon size="1.05rem" stroke={1.5} className={cn('shrink-0', open ? 'text-accent-fg' : 'text-fg-muted')} />
          <span className="shrink-0 text-[13px] font-medium text-fg-secondary">{title}</span>
          <span className={cn('min-w-0 flex-1 truncate text-right text-[11px] tabular-nums', warn ? 'text-red-400' : 'text-fg-muted')}>
            {warn && status.note ? status.note : status.summary}
          </span>
          {status.badge && <StatusBadge status={status} />}
          <IconChevronDown size={15} stroke={1.6} className="shrink-0 text-fg-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      <Collapse in={open}>
        <div className="px-3 pb-3 pt-1">{children}</div>
      </Collapse>
    </section>
  );
}
