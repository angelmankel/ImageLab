/**
 * The browser-style session tab strip (fix list 36; redesigned in fix list 2 #19). It takes the
 * free width between the logo divider and the right-side controls.
 *   Look: no borders or lines. The top bar is one shade darker than the page; the active tab is the
 *   page colour with inverse-rounded feet, so it flows into the screen below. Inactive = flat text,
 *   hover = a faint fill. Each session's colour (`~/app/sessionColor`, stored on the session) is the
 *   ring round its thumbnail; a running job fills the ring by its % and the ring breathes softly (never spins; #15). The ×
 *   shows on hover and on the active tab. No native `title` (item 20: one tooltip only).
 *   click = switch (and show the step screen) · drag = reorder · × or middle-click = close
 *   (never the last tab) · "+" = a new blank session · right-click = the 'tab' menu
 *   (`app/sessionMenus.ts`) · drop a history picture on the strip = a new session that duplicates
 *   the whole steps stack that made it (`newSessionFromImage`).
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { newSessionFromImage, useOpenSessions, useSessions, type Session } from '~/app/sessionsStore';
import { displayName } from '~/app/sessionsLogic';
import { colorOf } from '~/app/sessionColor';
import { useSteps } from '~/app/stepsStore';
import { useQueue } from '~/app/queue';
import { menuProps } from '~/app/contextMenu';
import { pushUndo } from '~/app/undo';
import { useImageDrop } from '~/dnd';
import { Tip } from '~/ui/Tip';
import { useSessionOutputs, type SessionOutput } from '~/screens/home/useSessionOutputs';
import { SessionThumb } from '~/screens/home/SessionThumb';
import { jobsBySession, type TabJob } from './tabJobs';
import { scrollIntoNearest } from '~/ui/scrollIntoNearest';

const TAB_MIME = 'application/x-imagelab-tab';

/** Close a tab; Ctrl+Z puts it back where it was (and makes the old current tab current again). */
function closeTabWithUndo(id: string): void {
  const st = useSessions.getState();
  const at = st.openIds.indexOf(id);
  const prev = st.currentId;
  if (!st.closeTab(id)) return;
  pushUndo({
    label: 'Close tab',
    undo: () => {
      const g = useSessions.getState();
      g.open(id);
      const from = useSessions.getState().openIds.indexOf(id);
      if (from >= 0 && at >= 0 && from !== at) useSessions.getState().moveTab(from, at);
      if (prev !== id) useSessions.getState().switchTo(prev);
    },
    redo: () => { useSessions.getState().closeTab(id); },
  });
}
const RING = 24;

/** The thumbnail in its session-colour ring; while a job runs the ring is its progress arc. */
export function SessionRing({ color, item, job, size = RING, bg = 'var(--il-bg-deep)' }: { color: string; item: SessionOutput['last']; job?: TabJob; size?: number; bg?: string }) {
  const running = !!job?.running;
  const pct = job?.progress != null ? Math.round(job.progress * 100) : null;
  const ring = running
    ? pct != null
      ? `conic-gradient(${color} ${Math.max(4, pct)}%, color-mix(in srgb, ${color} 22%, transparent) 0)`
      : color
    : job?.count ? `color-mix(in srgb, ${color} 55%, transparent)` : color;
  return (
    <span aria-hidden className={running ? 'il-tab-pulse' : undefined}
      style={{ position: 'relative', width: size, height: size, flex: 'none', borderRadius: '50%', padding: 2, background: ring, display: 'block', ['--il-ring' as string]: color }}>
      <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${bg}`, background: `color-mix(in srgb, ${color} 28%, var(--il-panel))` }}>
        {item && <SessionThumb item={item} autoplay={false} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />}
      </span>
    </span>
  );
}

function Tab({ s, index, current, only, out, job, dragId, setDragId, dropAt, setDropAt }: {
  s: Session; index: number; current: boolean; only: boolean; out?: SessionOutput; job?: TabJob;
  dragId: string | null; setDragId: (id: string | null) => void; dropAt: number | null; setDropAt: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const blank = !s.name.trim();
  const color = colorOf(s);
  const pct = job?.running && job.progress != null ? Math.round(job.progress * 100) : null;
  const open = () => { useSessions.getState().switchTo(s.id); if (useRoute.getState().screen !== 'step') useRoute.getState().go('step'); };
  const close = () => closeTabWithUndo(s.id);

  useEffect(() => { if (current) scrollIntoNearest(ref.current, { axis: 'x' }); }, [current]); // the tab strip only (item 39)

  const over = (e: DragEvent) => {
    if (!dragId || !e.dataTransfer.types.includes(TAB_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = ref.current!.getBoundingClientRect();
    setDropAt(e.clientX < r.left + r.width / 2 ? index : index + 1);
  };
  const showX = !only && (current || hover);

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={current}
      aria-label={`${displayName(s.name)}${job?.running ? `, running${pct != null ? ` ${pct}%` : ''}` : job?.count ? `, ${job.count} queued` : ''}`}
      tabIndex={0}
      draggable
      {...menuProps('tab', s)}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
      onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); if (!only) close(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragStart={(e) => { e.dataTransfer.setData(TAB_MIME, s.id); e.dataTransfer.effectAllowed = 'move'; setDragId(s.id); }}
      onDragEnd={() => { setDragId(null); setDropAt(null); }}
      onDragOver={over}
      className={current ? 'il-tab il-tab-on' : 'il-tab'}
      style={{
        position: 'relative', height: 44, minWidth: 0, flex: '0 1 200px', maxWidth: 220, padding: '0 6px 4px 10px',
        borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none',
        background: current ? 'var(--il-bg)' : hover ? 'color-mix(in srgb, var(--il-fg) 5%, transparent)' : 'transparent',
        color: current ? 'var(--il-fg)' : hover ? 'var(--il-fg2)' : 'var(--il-muted)',
        opacity: dragId === s.id ? 0.5 : 1, fontSize: 12, fontWeight: 700, outline: 'none', zIndex: current ? 1 : undefined,
      }}
    >
      {dropAt === index && dragId && dragId !== s.id && <span aria-hidden style={{ position: 'absolute', left: -2, top: 8, bottom: 8, width: 2, borderRadius: 1, background: color }} />}
      <SessionRing color={color} item={out?.last ?? null} job={job} bg={current ? 'var(--il-bg)' : 'var(--il-bg-deep)'} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: blank ? 'var(--il-dim)' : undefined }}>{displayName(s.name)}</span>
      <Tip label="Close tab">
        <button
          type="button"
          aria-label="Close tab"
          tabIndex={showX ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); if (!only) close(); }}
          style={{
            width: 24, height: 24, borderRadius: 7, border: 0, flex: 'none', display: only ? 'none' : 'grid', placeItems: 'center', padding: 0,
            background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer',
            opacity: showX ? 1 : 0, pointerEvents: showX ? undefined : 'none',
          }}
          className="il-tab-x"
        >
          <IconX size={13} stroke={2.6} />
        </button>
      </Tip>
    </div>
  );
}

export function SessionTabs() {
  const tabs = useOpenSessions();
  const currentId = useSessions((s) => s.currentId);
  const outputs = useSessionOutputs();
  const rows = useQueue().rows;
  const liveSteps = useSteps((s) => s.steps);
  const jobs = useMemo(() => jobsBySession(rows, tabs.map((t) => (t.id === currentId ? { id: t.id, steps: liveSteps } : t))), [rows, tabs, currentId, liveSteps]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  // A history picture dropped anywhere on the strip = a new session from it (item 28).
  const drop = useImageDrop({
    // Only the app's own results (they know the steps that made them).
    accept: (item) => item.kind === 'url' && !!item.payload && !!(item.payload.entryId || item.payload.key),
    onDrop: (item) => { if (item.kind === 'url' && item.payload) newSessionFromImage({ url: item.url, key: item.payload.key, entryId: item.payload.entryId, name: item.name }); },
  });

  const onDropTab = (e: DragEvent) => {
    if (!dragId || !e.dataTransfer.types.includes(TAB_MIME)) return;
    e.preventDefault();
    const st = useSessions.getState();
    const from = st.openIds.indexOf(dragId);
    if (from >= 0 && dropAt != null) st.moveTab(from, dropAt > from ? dropAt - 1 : dropAt);
    setDragId(null); setDropAt(null);
  };

  const create = () => { useSessions.getState().create(); useRoute.getState().go('step'); };

  return (
    <div
      role="tablist"
      aria-label="Sessions"
      {...drop.props}
      onDragOver={(e) => { if (dragId) { e.preventDefault(); return; } drop.props.onDragOver(e); }}
      onDrop={(e) => { if (dragId) onDropTab(e); else drop.props.onDrop(e); }}
      onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }}
      className="il-tabstrip"
      style={{
        flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, paddingTop: 12, paddingLeft: 12,
        overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
        borderRadius: 12, outline: drop.over ? '2px solid var(--il-ember)' : drop.active ? '1px dashed var(--il-ember-line)' : undefined, outlineOffset: -4,
        background: drop.over ? 'var(--il-ember-soft)' : undefined,
      }}
    >
      {tabs.map((s, i) => (
        <Tab key={s.id} s={s} index={i} current={s.id === currentId} only={tabs.length <= 1} out={outputs[s.id]} job={jobs[s.id]}
          dragId={dragId} setDragId={setDragId} dropAt={dropAt} setDropAt={setDropAt} />
      ))}
      <Tip label={drop.active ? 'New session from picture' : 'New session'}>
        <button
          type="button"
          aria-label="New session"
          onClick={create}
          style={{ width: 36, height: 36, flex: 'none', marginBottom: 4, marginLeft: 12, borderRadius: 10, border: 0, display: 'grid', placeItems: 'center', background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer' }}
          className="il-tab-new"
        >
          <IconPlus size={18} stroke={2.6} />
        </button>
      </Tip>
    </div>
  );
}
