/**
 * A named group of controls that can be folded away — without its values going with it.
 *
 * Styled after the v1 parameters panel: a flat accordion row with an icon, the name, and a chevron
 * on the right, divided from the next section by a rule. Collapsing is only honest if the header
 * still answers the question the section answers, so a folded section also shows a summary:
 * "25 steps · 1024 × 1024", "3 active parts". Nothing is moved behind a menu and nothing is dropped.
 *
 * Open/closed state lives in `sectionGroup`, so the panel toolbar can expand, collapse, or run the
 * panel in single-open mode. A section forced open by a search stays visually open without
 * disturbing what the person chose.
 */
import { useEffect, type ReactNode } from 'react';
import type { Icon as TablerIcon } from '@tabler/icons-react';
import { ChevronDownIcon } from '@/components/ui/icons';
import { loadCollapsed } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { isOpen, useSectionGroup } from './sectionGroup';

export interface ControlSectionProps {
  /** Stable key for the persisted open/closed state. */
  id: string;
  title: string;
  icon?: TablerIcon;
  /** The section's current values, in a few words. Shown while folded. */
  summary?: ReactNode;
  /** A switch or button that belongs to the section as a whole. Does not toggle the fold. */
  action?: ReactNode;
  defaultCollapsed?: boolean;
  /** Forces the section open regardless of stored state — used while a search is active. */
  forceOpen?: boolean;
  /** Expand when an action opens an editor, while still allowing manual collapse. */
  expandOn?: boolean;
  children: ReactNode;
}

export function ControlSection({
  id, title, icon: Icon, summary, action, defaultCollapsed = false, forceOpen, expandOn, children,
}: ControlSectionProps) {
  const stored = useSectionGroup(s => isOpen(s, id, defaultCollapsed));
  const setOpen = useSectionGroup(s => s.setOpen);
  const open = forceOpen || stored;

  useEffect(() => {
    const group = useSectionGroup.getState();
    // First run after the move to the shared store: carry over what the old per-section key held.
    if (group.collapsed[id] === undefined) {
      useSectionGroup.setState(s => ({ collapsed: { ...s.collapsed, [id]: loadCollapsed(`controls.${id}`, defaultCollapsed) } }));
    }
    group.register(id, defaultCollapsed);
    return () => useSectionGroup.getState().unregister(id);
  }, [id, defaultCollapsed]);

  useEffect(() => { if (expandOn) setOpen(id, true); }, [expandOn, id, setOpen]);

  const toggle = () => setOpen(id, !open);

  return (
    // `shrink-0` is load-bearing. The panel body is a flex column inside a scroll container, and a
    // flex item shrinks to fit by default — so each section was squashed by the one after it and
    // clipped its own contents.
    <section className="shrink-0 border-b border-border-default last:border-b-0">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 pl-3 pr-1 text-left outline-none focus-visible:bg-white/[0.03]"
        >
          {Icon && <Icon size="1.1rem" stroke={1.5} className="shrink-0" />}
          <span className="shrink-0 text-[14px] font-medium text-fg-secondary">{title}</span>
          {!open && summary != null && (
            <span className="min-w-0 flex-1 truncate text-right text-[11.5px] tabular-nums text-fg-muted">
              {summary}
            </span>
          )}
        </button>
        {action && (
          // Outside the toggle button: a nested button cannot be tapped without also folding.
          <div className="flex shrink-0 items-center">{action}</div>
        )}
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-elev hover:text-fg-secondary"
        >
          <ChevronDownIcon size={13} className={cn('transition-transform duration-150', open && 'rotate-180')} />
        </button>
      </div>
      {open && <div className="flex flex-col gap-1 px-3 pb-4 pt-0.5">{children}</div>}
    </section>
  );
}
