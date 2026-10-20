/**
 * The browser-style session tab strip (fix list 36, replacing 27 / 28's session component). It
 * takes the free width between the logo divider and the right-side controls.
 *   click = switch (and show the step screen) · drag = reorder · × or middle-click = close
 *   (never the last tab) · "+" = a new blank session · right-click = the 'tab' menu
 *   (`app/sessionMenus.ts`) · drop a history picture on the strip = a new session that duplicates
 *   the whole steps stack that made it (`newSessionFromImage`).
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { newSessionFromImage, useOpenSessions, useSessions, type Session } from '~/app/sessionsStore';
import { displayName } from '~/app/sessionsLogic';
import { menuProps } from '~/app/contextMenu';
import { useImageDrop } from '~/dnd';
import { Tip } from '~/ui/Tip';
import { useSessionOutputs, type SessionOutput } from '~/screens/home/useSessionOutputs';
import { SessionThumb } from '~/screens/home/SessionThumb';

const TAB_MIME = 'application/x-imagelab-tab';

function Tab({ s, index, current, only, out, dragId, setDragId, dropAt, setDropAt }: {
  s: Session; index: number; current: boolean; only: boolean; out?: SessionOutput;
  dragId: string | null; setDragId: (id: string | null) => void; dropAt: number | null; setDropAt: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const blank = !s.name.trim();
  const open = () => { useSessions.getState().switchTo(s.id); if (useRoute.getState().screen !== 'step') useRoute.getState().go('step'); };
  const close = () => { useSessions.getState().closeTab(s.id); };

  useEffect(() => { if (current) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [current]);

  const over = (e: DragEvent) => {
    if (!dragId || !e.dataTransfer.types.includes(TAB_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = ref.current!.getBoundingClientRect();
    setDropAt(e.clientX < r.left + r.width / 2 ? index : index + 1);
  };

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={current}
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
      title={displayName(s.name)}
      style={{
        position: 'relative', height: 40, minWidth: 0, flex: '0 1 200px', maxWidth: 220, padding: '0 6px 0 10px',
        borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
        background: current ? 'var(--il-elev)' : hover ? 'var(--il-panel)' : 'transparent',
        color: current ? 'var(--il-fg)' : hover ? 'var(--il-fg2)' : 'var(--il-muted)',
        boxShadow: current ? 'inset 0 2px 0 var(--il-ember)' : undefined,
        opacity: dragId === s.id ? 0.5 : 1, fontSize: 12, fontWeight: 700, outline: 'none',
      }}
    >
      {dropAt === index && dragId && dragId !== s.id && <span aria-hidden style={{ position: 'absolute', left: -2, top: 8, bottom: 4, width: 2, borderRadius: 1, background: 'var(--il-ember)' }} />}
      <SessionThumb item={out?.last ?? null} style={{ width: 20, height: 20, borderRadius: 6, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: blank ? 'var(--il-dim)' : undefined }}>{displayName(s.name)}</span>
      <Tip label={only ? 'The last tab stays open' : 'Close (middle-click)'}>
        <button
          type="button"
          aria-label="Close tab"
          disabled={only}
          onClick={(e) => { e.stopPropagation(); close(); }}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 0, flex: 'none', display: 'grid', placeItems: 'center', padding: 0,
            background: 'transparent', color: 'var(--il-dim)', cursor: only ? 'default' : 'pointer',
            opacity: only ? 0.3 : current || hover ? 1 : 0.55,
          }}
          className={only ? undefined : 'il-tab-x'}
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
        flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, paddingTop: 12,
        overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
        borderRadius: 12, outline: drop.over ? '2px solid var(--il-ember)' : drop.active ? '1px dashed var(--il-ember-line)' : undefined, outlineOffset: -4,
        background: drop.over ? 'var(--il-ember-soft)' : undefined,
      }}
    >
      {tabs.map((s, i) => (
        <Tab key={s.id} s={s} index={i} current={s.id === currentId} only={tabs.length <= 1} out={outputs[s.id]}
          dragId={dragId} setDragId={setDragId} dropAt={dropAt} setDropAt={setDropAt} />
      ))}
      <Tip label={drop.active ? 'Drop: a new session from this picture' : 'New session'}>
        <button
          type="button"
          aria-label="New session"
          onClick={create}
          style={{ width: 36, height: 36, flex: 'none', marginBottom: 2, borderRadius: 10, border: 0, display: 'grid', placeItems: 'center', background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer' }}
          className="il-tab-new"
        >
          <IconPlus size={18} stroke={2.6} />
        </button>
      </Tip>
    </div>
  );
}
