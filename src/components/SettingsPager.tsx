/**
 * A phone settings list: one big row per section with its live summary and badge; tapping a row
 * slides that section in full screen, with Back and the previous / next section in the header.
 * Generate's Parameters tab and the Video view both use it, so the two feel the same.
 *
 * Back is also a swipe to the right anywhere on the page that does not start on a control of its
 * own (slider, text box, sideways-scrolling row), and the phone's own back button or gesture (the
 * open page holds one history entry). Pages mount on first open and stay mounted, so a
 * half-written prompt or an open editor survives a trip back to the list.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, type Icon as TablerIcon } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { useSwipe } from '@/hooks/useSwipe';

const SLIDE = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';

export interface PagerStatus {
  summary: string;
  badge?: string;
  /** `warn` shows the note instead of the summary, in red. */
  tone?: 'accent' | 'warn';
  note?: string;
}

export interface PagerRow<T extends string> {
  id: T;
  title: string;
  icon: TablerIcon;
  status: PagerStatus;
}

export function SettingsPager<T extends string>({ rows, renderPage, menu, onMenuSwipeLeft, reveal, onRevealed, pageIdPrefix }: {
  rows: readonly PagerRow<T>[];
  renderPage: (id: T) => ReactNode;
  /** The menu's content around the rows (`nav`): notes above, actions and hints below. */
  menu: (nav: ReactNode) => ReactNode;
  /** A swipe to the left on the menu (to the view's result tab). */
  onMenuSwipeLeft?: () => void;
  /** Open this page (the quick search's "show section"); `onRevealed` clears the request. */
  reveal?: T | null;
  onRevealed?: () => void;
  /** Each page's element id is this plus its row id. */
  pageIdPrefix: string;
}) {
  const order = rows.map(r => r.id);
  const orderKey = order.join(' ');

  const [open, setOpen] = useState<T | null>(null);
  // What the page shows: the open section, or the last one while it slides away.
  const [shown, setShown] = useState<T | null>(null);
  const [mounted, setMounted] = useState<ReadonlySet<T>>(() => new Set());
  const [drag, setDrag] = useState(0);
  const pushed = useRef(false);

  const show = useCallback((id: T) => {
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

  // A section that is no longer listed closes its page.
  useEffect(() => { if (open && !order.includes(open)) back(); }, [open, orderKey, back]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!reveal) return;
    if (order.includes(reveal)) show(reveal);
    onRevealed?.();
  }, [reveal, orderKey, show, onRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useSwipe(pageRef, { dir: 1, enabled: open != null, onSwipe: back, onMove: setDrag });
  useSwipe(menuRef, { dir: -1, enabled: open == null && !!onMenuSwipeLeft, onSwipe: () => onMenuSwipeLeft?.() });
  // Whichever layer is underneath takes no taps or focus (React 18 has no `inert` prop).
  useEffect(() => {
    menuRef.current?.toggleAttribute('inert', open != null);
    pageRef.current?.toggleAttribute('inert', open == null);
  }, [open]);

  const at = shown ? order.indexOf(shown) : -1;
  const prev = at > 0 ? rows[at - 1] : undefined;
  const next = at >= 0 && at < order.length - 1 ? rows[at + 1] : undefined;
  const title = (id: T) => rows.find(r => r.id === id)?.title ?? '';

  const nav = (
    <nav aria-label="Settings" className="overflow-hidden rounded-xl border border-border-default bg-bg-panel">
      {rows.map((row, i) => <MenuRow key={row.id} row={row} first={i === 0} onOpen={() => show(row.id)} />)}
    </nav>
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* The menu */}
      {/* isolate: Mantine's SegmentedControl gives its labels a z-index, which otherwise paints
          the menu's Simple/Advanced switch on top of an open page. */}
      <div ref={menuRef} className="scroll-y absolute inset-0 overflow-x-hidden px-3 pb-4 pt-3" style={{ touchAction: 'pan-y', isolation: 'isolate' }}
        aria-hidden={open ? true : undefined}>
        {menu(nav)}
      </div>

      {/* The page */}
      <div
        ref={pageRef}
        className="absolute inset-0 flex flex-col bg-bg-base"
        style={{
          transform: open ? `translateX(${drag}px)` : 'translateX(100%)',
          transition: drag ? 'none' : SLIDE,
          touchAction: 'pan-y',
          zIndex: 1,
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
              <div className="truncate text-[15px] font-semibold text-fg-primary">{title(shown)}</div>
            </div>
            <StepButton dir={-1} to={prev} onGo={show} />
            <StepButton dir={1} to={next} onGo={show} />
          </header>
        )}
        <div className="relative min-h-0 flex-1">
          {order.filter(id => mounted.has(id)).map(id => (
            <section key={id} id={`${pageIdPrefix}${id}`} aria-label={title(id)} hidden={id !== shown}
              // pan-y here too: touch-action stops at a scroll container, so the page's own does not reach in.
              className="scroll-y absolute inset-0 overflow-x-hidden px-3 pb-6 pt-3" style={{ touchAction: 'pan-y' }}>
              {renderPage(id)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuRow<T extends string>({ row, first, onOpen }: { row: PagerRow<T>; first: boolean; onOpen: () => void }) {
  const { title, icon: Icon, status } = row;
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
      {status.badge && <StatusBadge status={status} />}
      <IconChevronRight size={18} stroke={1.6} className="shrink-0 text-fg-muted" />
    </button>
  );
}

/** A row's badge: red for a warning, accent for something switched on. */
export function StatusBadge({ status }: { status: PagerStatus }) {
  return (
    <span className={cn(
      'shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums',
      status.tone === 'warn' ? 'bg-red-500 text-white' : status.tone === 'accent' ? 'bg-accent text-white' : 'bg-bg-elev text-fg-secondary',
    )}>
      {status.badge}
    </span>
  );
}

/** The header's previous / next section, named so it is clear where it goes. */
function StepButton<T extends string>({ dir, to, onGo }: { dir: 1 | -1; to?: PagerRow<T>; onGo: (id: T) => void }) {
  const Icon = dir < 0 ? IconChevronLeft : IconChevronRight;
  return (
    <button type="button" disabled={!to} onClick={() => to && onGo(to.id)}
      aria-label={to ? `${dir < 0 ? 'Previous' : 'Next'}: ${to.title}` : undefined}
      className="flex h-11 w-10 shrink-0 items-center justify-center rounded-md text-fg-secondary outline-none active:bg-bg-elev disabled:opacity-25">
      <Icon size={20} stroke={1.7} />
    </button>
  );
}
