/**
 * The phone's Parameters tab: a settings list, not the desktop's tab bar.
 *
 *   ┌ ✎ Prompts        1girl, beach…     › ┐   the menu: one big row per section, with its live
 *   │ ▣ Models         waiIllustrious  2 › │   summary and badge, in the user's tab order
 *   │ ⚙ Parameters     Euler a · 28 steps › │   (hidden tabs stay hidden)
 *   │ …                                    │
 *   │ [Clear all]          Presets 1 2 3 4 5 │
 *   ├ Seed [ 12345 ] 🎲 Auto       (+)(▶)   ┤   footer under both menu and page
 *
 * Tapping a row slides its section in full screen, with Back and the previous / next section in
 * the header. Back is also: a swipe to the right anywhere on the page that does not start on a
 * control of its own (slider, text box, sideways-scrolling row), and the phone's own back button
 * or gesture (the open page holds one history entry). On the menu, a swipe to the left goes to
 * the Image tab. Sections mount on first open and stay mounted, so a half-written prompt or an
 * open editor survives a trip back to the list. The quick search's "show section" opens the page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { emitApp } from '@/lib/appEvents';
import type { SectionId } from '@/lib/panelTabs';
import { useSwipe } from '@/hooks/useSwipe';
import { PanelToolbar } from '@/features/controls/PanelToolbar';
import { GenerationProgress } from '@/features/generate/GenerationProgress';
import { SeedRow, usePanelScope } from '@/features/layout/LeftPanel';
import { usePanelTabs } from './panelTabsStore';
import { SECTION_META, SectionBody, availableSections, useSectionStatus, type SectionStatus } from './sections';

const SLIDE = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';

export function MobileParameters() {
  const { scope, empty, note } = usePanelScope();
  const tabs = usePanelTabs(s => s.tabs);
  const reveal = usePanelTabs(s => s.reveal);
  const clearReveal = usePanelTabs(s => s.clearReveal);
  const status = useSectionStatus(scope);

  // The rows follow the user's tab layout, so the phone and the desktop agree on the order.
  const available = useMemo(() => availableSections(scope), [scope.layerScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(
    () => tabs.filter(t => !t.hidden).flatMap(t => t.sections).filter(s => available.includes(s)),
    [tabs, available],
  );

  const [open, setOpen] = useState<SectionId | null>(null);
  // What the page shows: the open section, or the last one while it slides away.
  const [shown, setShown] = useState<SectionId | null>(null);
  const [mounted, setMounted] = useState<ReadonlySet<SectionId>>(() => new Set());
  const [drag, setDrag] = useState(0);
  const pushed = useRef(false);

  const show = useCallback((id: SectionId) => {
    setOpen(id);
    setShown(id);
    setMounted(prev => (prev.has(id) ? prev : new Set([...prev, id])));
    if (!pushed.current) {
      history.pushState({ imagelabSection: true }, '');
      pushed.current = true;
    }
  }, []);
  const back = useCallback(() => {
    // Leave through history, so the entry the page pushed is used up; popstate closes it.
    if (pushed.current) history.back();
    else setOpen(null);
  }, []);
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      setOpen(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A section that is no longer listed (canvas layer scope, a hidden tab) closes its page.
  useEffect(() => { if (open && !order.includes(open)) back(); }, [open, order, back]);

  // The quick search asked for a section.
  useEffect(() => {
    if (!reveal) return;
    if (order.includes(reveal)) show(reveal);
    clearReveal();
  }, [reveal, order, show, clearReveal]);

  const pageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useSwipe(pageRef, { dir: 1, enabled: open != null, onSwipe: back, onMove: setDrag });
  useSwipe(menuRef, { dir: -1, enabled: open == null, onSwipe: () => emitApp('mobile-tab', 'image') });
  // Whichever layer is underneath takes no taps or focus (React 18 has no `inert` prop).
  useEffect(() => {
    menuRef.current?.toggleAttribute('inert', open != null);
    pageRef.current?.toggleAttribute('inert', open == null);
  }, [open]);

  const at = shown ? order.indexOf(shown) : -1;
  const prev = at > 0 ? order[at - 1] : undefined;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Generation workspace">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* The menu */}
        <div ref={menuRef} className="scroll-y absolute inset-0 overflow-x-hidden px-3 pb-4 pt-3" style={{ touchAction: 'pan-y' }}
          aria-hidden={open ? true : undefined}>
          {note && <div className="mb-2 truncate px-1 text-[12px] text-fg-muted">Editing layer: {note}</div>}
          {empty ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-muted">
              Select a canvas layer to edit its prompt and settings.
            </div>
          ) : (
            <>
              <nav aria-label="Settings" className="overflow-hidden rounded-xl border border-border-default bg-bg-panel">
                {order.map((id, i) => (
                  <MenuRow key={id} id={id} status={status[id]} first={i === 0} onOpen={() => show(id)} />
                ))}
              </nav>
              <div className="mt-3 rounded-xl border border-border-default bg-bg-panel px-3 py-2">
                <PanelToolbar big />
              </div>
              <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-muted">
                Swipe right on a page to come back here. Swipe left here for the image.
              </p>
            </>
          )}
        </div>

        {/* The page */}
        <div
          ref={pageRef}
          className="absolute inset-0 flex flex-col bg-bg-base"
          style={{
            transform: open ? `translateX(${drag}px)` : 'translateX(100%)',
            transition: drag ? 'none' : SLIDE,
            touchAction: 'pan-y',
            boxShadow: open || drag ? '-12px 0 24px rgba(0, 0, 0, 0.35)' : 'none',
          }}
          onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setShown(null); }}
          aria-hidden={open ? undefined : true}
        >
          {shown && (
            <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border-default bg-bg-panel pr-1">
              <button type="button" onClick={back} aria-label="Back to settings"
                className="flex h-12 shrink-0 items-center gap-0.5 pl-1.5 pr-2 text-[14px] text-accent-fg outline-none active:opacity-60">
                <IconChevronLeft size={22} stroke={1.8} />
                Back
              </button>
              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-[15px] font-semibold text-fg-primary">{SECTION_META[shown].title}</div>
              </div>
              <StepButton dir={-1} to={prev} onGo={show} />
              <StepButton dir={1} to={next} onGo={show} />
            </header>
          )}
          <div className="relative min-h-0 flex-1">
            {order.filter(id => mounted.has(id)).map(id => (
              <section key={id} id={`panel-section-${id}`} aria-label={SECTION_META[id].title} hidden={id !== shown}
                // pan-y here too: touch-action stops at a scroll container, so the page's own does not reach in.
                className="scroll-y absolute inset-0 overflow-x-hidden px-3 pb-6 pt-3" style={{ touchAction: 'pan-y' }}>
                <SectionBody id={id} scope={scope} />
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Under both: the run's progress and the seed, clear of the floating Generate buttons. */}
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border-default bg-bg-panel py-2 pl-3 pr-[150px]" style={{ minHeight: 80 }}>
        <GenerationProgress />
        {!empty && <SeedRow />}
      </div>
    </div>
  );
}

function MenuRow({ id, status, first, onOpen }: { id: SectionId; status: SectionStatus; first: boolean; onOpen: () => void }) {
  const { title, icon: Icon } = SECTION_META[id];
  return (
    <button type="button" onClick={onOpen}
      className={cn(
        'flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors active:bg-bg-elev focus-visible:bg-bg-elev',
        !first && 'border-t border-border-default',
      )}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
        <Icon size={19} stroke={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-fg-primary">{title}</span>
        <span className={cn('line-clamp-2 block text-[12px] leading-snug', status.tone === 'warn' ? 'text-red-400' : 'text-fg-muted')}>
          {status.tone === 'warn' && status.note ? status.note : status.summary}
        </span>
      </span>
      {status.badge && (
        <span className={cn(
          'shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums',
          status.tone === 'warn' ? 'bg-red-500 text-white' : status.tone === 'accent' ? 'bg-accent text-white' : 'bg-bg-elev text-fg-secondary',
        )}>
          {status.badge}
        </span>
      )}
      <IconChevronRight size={18} stroke={1.6} className="shrink-0 text-fg-muted" />
    </button>
  );
}

/** The header's previous / next section, named so it is clear where it goes. */
function StepButton({ dir, to, onGo }: { dir: 1 | -1; to?: SectionId; onGo: (id: SectionId) => void }) {
  const Icon = dir < 0 ? IconChevronLeft : IconChevronRight;
  return (
    <button type="button" disabled={!to} onClick={() => to && onGo(to)}
      aria-label={to ? `${dir < 0 ? 'Previous' : 'Next'}: ${SECTION_META[to].title}` : undefined}
      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-md text-fg-secondary outline-none active:bg-bg-elev disabled:opacity-25">
      <Icon size={20} stroke={1.7} />
    </button>
  );
}
