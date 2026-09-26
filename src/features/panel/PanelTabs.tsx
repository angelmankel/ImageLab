/**
 * The left panel as tabs: a tab bar, an optional summary strip, and one scroll area per tab.
 *
 * Which sections sit in which tab, the order, names and icons are the user's (see
 * `panelTabsStore`). A tab mounts on its first visit and then stays mounted but hidden, so its
 * scroll position and any half-open editor inside it survive a trip to another tab.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { IconSettings } from '@tabler/icons-react';
import {
  DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tip } from '@/components/ui/Tooltip';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { cn } from '@/lib/cn';
import { barTabs, resolveActive, type PanelTab, type SectionId } from '@/lib/panelTabs';
import { usePanelTabs } from './panelTabsStore';
import {
  SECTION_META, SectionBody, availableSections, tabIcon, useSectionStatus, type PanelScope, type SectionStatus,
} from './sections';
import { SummaryStrip } from './SummaryStrip';
import { CustomizeTabsModal } from './CustomizeTabsModal';

/** Alt+1…9. macOS turns Option+digit into these characters, so they are listed too (US layout). */
const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MAC_OPTION_DIGITS = ['¡', '™', '£', '¢', '∞', '§', '¶', '•', 'ª'];
const TAB_SHORTCUTS = [...DIGIT_KEYS, ...MAC_OPTION_DIGITS].map(k => `alt+${k}`);

/** The badge a tab shows: a warning from any of its sections wins, else the first badge. */
function tabBadge(tab: PanelTab, available: readonly SectionId[], status: Record<SectionId, SectionStatus>): SectionStatus | undefined {
  const own = tab.sections.filter(s => available.includes(s)).map(s => status[s]).filter(s => s.badge);
  return own.find(s => s.tone === 'warn') ?? own[0];
}

export function PanelTabs({ scope }: { scope: PanelScope }) {
  const tabs = usePanelTabs(s => s.tabs);
  const stored = usePanelTabs(s => s.active);
  const labels = usePanelTabs(s => s.labels);
  const strip = usePanelTabs(s => s.strip);
  const setActive = usePanelTabs(s => s.setActive);
  const [customizing, setCustomizing] = useState(false);

  const available = useMemo(() => availableSections(scope), [scope.layerScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const bar = useMemo(() => barTabs(tabs, available, stored), [tabs, available, stored]);
  const active = resolveActive(bar, stored);
  const status = useSectionStatus(scope);

  // Mount on first visit, then keep: switching back finds the tab exactly as it was left.
  const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set(active ? [active] : []));
  useEffect(() => {
    if (active && !mounted.has(active)) setMounted(prev => new Set([...prev, active]));
  }, [active, mounted]);

  useShortcut(TAB_SHORTCUTS, (e) => {
    const digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? String(MAC_OPTION_DIGITS.indexOf(e.key) + 1 || e.key);
    const tab = bar[Number(digit) - 1];
    if (!tab) return false;
    e.preventDefault();
    setActive(tab.id);
  }, { priority: ShortcutPriority.Panel, skipTyping: false });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabBar bar={bar} active={active} labels={labels} available={available} status={status}
        onSelect={setActive} onCustomize={() => setCustomizing(true)} />
      {strip && <SummaryStrip scope={scope} status={status} />}
      <div className="relative min-h-0 flex-1">
        {bar.filter(t => mounted.has(t.id) || t.id === active).map(t => (
          <div
            key={t.id}
            role="tabpanel"
            id={`panel-tabpanel-${t.id}`}
            aria-labelledby={`panel-tab-${t.id}`}
            hidden={t.id !== active}
            className="scroll-y absolute inset-0 overflow-x-hidden px-3 pb-4 pt-2"
          >
            <TabContent tab={t} available={available} scope={scope} status={status} isActive={t.id === active} />
          </div>
        ))}
        {!bar.length && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-muted">
            Every tab is hidden or empty. Open the tab settings to bring one back.
          </div>
        )}
      </div>
      <CustomizeTabsModal opened={customizing} onClose={() => setCustomizing(false)} />
    </div>
  );
}

function TabBar({ bar, active, labels, available, status, onSelect, onCustomize }: {
  bar: PanelTab[];
  active: string | null;
  labels: 'auto' | 'labels' | 'icons';
  available: readonly SectionId[];
  status: Record<SectionId, SectionStatus>;
  onSelect: (id: string) => void;
  onCustomize: () => void;
}) {
  const moveTab = usePanelTabs(s => s.moveTab);
  const scroller = useRef<HTMLDivElement>(null);

  // Auto labels: try every label; if they overflow, only the active tab keeps its label. The width
  // the full bar needs is measured once per layout and compared on every resize.
  const [fits, setFits] = useState(true);
  const needed = useRef(0);
  const badges = bar.map(t => tabBadge(t, available, status));
  // Anything that changes a tab's width: names and badges ("×3" appearing widens its tab).
  const layoutKey = bar.map((t, i) => `${t.id}:${t.label}:${badges[i]?.badge ?? ''}`).join('|');
  useLayoutEffect(() => { needed.current = 0; setFits(true); }, [layoutKey, labels]);
  useLayoutEffect(() => {
    const el = scroller.current;
    // A hidden panel (the phone's Parameters tab while on Image) measures 0: wait until shown.
    if (!el || labels !== 'auto' || !fits || !el.clientWidth) return;
    needed.current = el.scrollWidth;
    if (el.scrollWidth > el.clientWidth + 1) setFits(false);
  }, [fits, layoutKey, labels]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || labels !== 'auto') return;
    const ro = new ResizeObserver(() => {
      if (!el.clientWidth) return;
      // Never measured (mounted hidden): every label is showing right now, so measure it here.
      if (!needed.current) needed.current = el.scrollWidth;
      setFits(needed.current <= el.clientWidth + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [labels]);

  // The active tab is always scrolled into view, e.g. after Alt+7 on a narrow bar.
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, fits]);

  const showLabel = (id: string) => labels === 'labels' || (labels === 'auto' && (fits || id === active));

  // Mouse drags after a few pixels; touch needs a short hold, so a swipe still scrolls the bar.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) moveTab(String(e.active.id), String(e.over.id));
  };

  // Roving focus, as a tablist should: arrows move between tabs, Home/End jump to the ends.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const i = bar.findIndex(t => t.id === active);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? bar.length - 1 : null;
    if (next == null || !bar.length) return;
    e.preventDefault();
    e.stopPropagation();
    const tab = bar[(next + bar.length) % bar.length];
    onSelect(tab.id);
    requestAnimationFrame(() => document.getElementById(`panel-tab-${tab.id}`)?.focus());
  };

  return (
    <div className="flex shrink-0 items-stretch border-b border-border-default bg-bg-base/40">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={bar.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div ref={scroller} role="tablist" aria-label="Panel tabs" onKeyDown={onKeyDown}
            className="scroll-x-thin flex min-w-0 flex-1 items-stretch gap-0.5 px-1.5">
            {bar.map((t, i) => (
              <TabButton key={t.id} tab={t} index={i} active={t.id === active} showLabel={showLabel(t.id)}
                badge={badges[i]} onSelect={onSelect} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Tip label="Customise tabs" side="bottom">
        <button type="button" onClick={onCustomize} aria-label="Customise tabs"
          className="flex w-10 shrink-0 items-center justify-center border-l border-border-default text-fg-muted outline-none transition-colors hover:bg-bg-elev hover:text-fg-secondary focus-visible:ring-1 focus-visible:ring-accent">
          <IconSettings size={16} stroke={1.6} />
        </button>
      </Tip>
    </div>
  );
}

function TabButton({ tab, index, active, showLabel, badge, onSelect }: {
  tab: PanelTab; index: number; active: boolean; showLabel: boolean; badge?: SectionStatus; onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const Icon = tabIcon(tab.icon);
  const tip = [tab.label, index < 9 ? `Alt+${index + 1}` : null, tab.hidden ? 'hidden tab' : null, badge?.note].filter(Boolean).join(' · ');
  return (
    <Tip label={tip} side="bottom">
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        role="tab"
        aria-roledescription={undefined}
        id={`panel-tab-${tab.id}`}
        aria-selected={active}
        aria-controls={`panel-tabpanel-${tab.id}`}
        aria-label={showLabel ? undefined : tab.label}
        tabIndex={active ? 0 : -1}
        onClick={() => onSelect(tab.id)}
        style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 1 : undefined }}
        className={cn(
          // 44px tall: a thumb-sized target on a phone.
          'relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-[13px] outline-none transition-colors',
          'after:absolute after:inset-x-1.5 after:bottom-0 after:h-0.5 after:rounded-full',
          'focus-visible:bg-white/[0.04]',
          active ? 'font-medium text-fg-primary after:bg-accent' : 'text-fg-muted hover:text-fg-secondary',
          tab.hidden && 'italic',
          isDragging && 'cursor-grabbing opacity-80',
        )}
      >
        <Icon size={17} stroke={1.6} className={cn('shrink-0', active && 'text-accent-fg')} />
        {showLabel && <span>{tab.label}</span>}
        {badge?.badge && (
          <span
            aria-hidden
            className={cn(
              'rounded-full px-1 text-center text-[9.5px] font-semibold leading-[14px] tabular-nums',
              showLabel ? 'min-w-[14px]' : 'absolute right-0.5 top-1.5 min-w-[14px]',
              badge.tone === 'warn' ? 'bg-red-500 text-white'
                : badge.tone === 'accent' ? 'bg-accent text-white'
                  : 'bg-bg-elev text-fg-secondary',
            )}
          >
            {badge.badge}
          </span>
        )}
      </button>
    </Tip>
  );
}

function TabContent({ tab, available, scope, status, isActive }: {
  tab: PanelTab; available: readonly SectionId[]; scope: PanelScope; status: Record<SectionId, SectionStatus>; isActive: boolean;
}) {
  const sections = tab.sections.filter(s => available.includes(s));
  const reveal = usePanelTabs(s => s.reveal);
  const clearReveal = usePanelTabs(s => s.clearReveal);

  // A jump from the summary strip lands on the section, not just its tab.
  useEffect(() => {
    if (!isActive || !reveal || !sections.includes(reveal)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`panel-section-${reveal}`)?.scrollIntoView({ block: 'start' });
      clearReveal();
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, reveal, sections, clearReveal]);

  const multi = sections.length > 1;
  return (
    <div className="flex flex-col">
      {sections.map((id, i) => {
        const { title, icon: Icon } = SECTION_META[id];
        return (
          // `shrink-0`: a flex child shrinks by default and would clip its own controls.
          <section key={id} id={`panel-section-${id}`} aria-label={title}
            className={cn('shrink-0 scroll-mt-1', multi && i > 0 && 'mt-3 border-t border-border-default pt-1')}>
            {multi && (
              <header className="flex min-h-9 items-center gap-2 pb-1">
                <Icon size="1.05rem" stroke={1.5} className="shrink-0 text-fg-muted" />
                <span className="shrink-0 text-[13px] font-medium text-fg-secondary">{title}</span>
                <span className="min-w-0 flex-1 truncate text-right text-[11px] tabular-nums text-fg-muted">{status[id].summary}</span>
              </header>
            )}
            <SectionBody id={id} scope={scope} />
          </section>
        );
      })}
    </div>
  );
}
