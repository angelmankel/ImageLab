/**
 * Home (fix list 20): every session as a masonry tile, the picture = that session's last output
 * (its own aspect ratio), a dark "No output yet" placeholder otherwise. The first tile is
 * "+ New session": a blank, unnamed session at once (no name prompt). Click a tile = open it (a
 * tab opens if needed) and go to its step screen. ⋯ / right-click = Open · Rename · Duplicate ·
 * Delete (Undo, 3 s; the pictures stay in History). Recent / Name order, remembered.
 * Reached from ← Home and the logo (desktop), More → All sessions (phone).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IconDots, IconPlus } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { useSessions, type Session } from '~/app/sessionsStore';
import { ago, byName, byRecent, displayName } from '~/app/sessionsLogic';
import { menuProps, openMenu } from '~/app/contextMenu';
import { useSteps } from '~/app/stepsStore';
import { SessionThumb } from './SessionThumb';
import { useSessionOutputs, type SessionOutput } from './useSessionOutputs';
import { registerHomeMenu } from './homeMenu';
import '~/screens/image/topbar/shell.css';

registerHomeMenu();

interface HomeUi { order: 'recent' | 'name'; renaming: string | null; setOrder: (o: 'recent' | 'name') => void; setRenaming: (id: string | null) => void }
export const useHomeUi = create<HomeUi>()(persist((set) => ({
  order: 'recent', renaming: null,
  setOrder: (order) => set({ order }),
  setRenaming: (renaming) => set({ renaming }),
}), { name: 'imagelab.next.home.v1', partialize: (s) => ({ order: s.order }) }));

function openSession(id: string) {
  useSessions.getState().open(id);
  useRoute.getState().go('step');
}

function NameEdit({ s, onDone }: { s: Session; onDone: () => void }) {
  const [draft, setDraft] = useState(s.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const save = () => {
    const st = useSessions.getState();
    if (s.id === st.currentId) useSteps.getState().renameSession(draft);
    else st.rename(s.id, draft);
    onDone();
  };
  return (
    <input ref={ref} value={draft} placeholder="Untitled session" aria-label="Session name" maxLength={80}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') save(); else if (e.key === 'Escape') onDone(); }}
      onBlur={save}
      style={{ flex: 1, minWidth: 0, height: 24, border: 0, outline: '2px solid var(--il-ember)', borderRadius: 6, background: 'var(--il-elev)', color: 'var(--il-fg)', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, padding: '0 6px' }} />
  );
}

function Tile({ s, out, isOpen, now, phone }: { s: Session; out?: SessionOutput; isOpen: boolean; now: number; phone: boolean }) {
  const renaming = useHomeUi((u) => u.renaming === s.id);
  const setRenaming = useHomeUi((u) => u.setRenaming);
  const last = out?.last ?? null;
  const blank = !s.name.trim();
  const steps = s.steps.length;
  const more = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu('session', s, { x: r.left, y: r.bottom + 4 });
  };
  return (
    <div
      role="button"
      tabIndex={0}
      {...menuProps('session', s)}
      onClick={() => { if (!renaming) openSession(s.id); }}
      onKeyDown={(e) => { if (!renaming && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSession(s.id); } }}
      className="il-home-tile"
      style={{ breakInside: 'avoid', marginBottom: phone ? 10 : 12, borderRadius: 14, overflow: 'hidden', background: 'var(--il-panel)', border: '1px solid var(--il-line)', position: 'relative', cursor: 'pointer' }}
    >
      <SessionThumb item={last} label="No output yet" style={{ width: '100%', height: last ? 'auto' : undefined, aspectRatio: last ? undefined : '1', minHeight: 60, maxHeight: 520 }} />
      <div style={{ padding: '8px 10px 9px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
        {renaming
          ? <NameEdit s={s} onDone={() => setRenaming(null)} />
          : <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: blank ? 'var(--il-dim)' : 'var(--il-fg)' }}>{displayName(s.name)}</span>}
        <span style={{ fontSize: 11, color: 'var(--il-muted)', fontWeight: 700, whiteSpace: 'nowrap', flex: 'none' }}>
          {steps} {steps === 1 ? 'step' : 'steps'}{phone ? '' : ` · ${ago(s.updatedAt, now)}`}
        </span>
      </div>
      {isOpen && <span style={{ position: 'absolute', top: 8, left: 8, height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', letterSpacing: '.4px' }}>OPEN</span>}
      <button type="button" aria-label="Session menu" onClick={more} className="il-home-more"
        style={{ position: 'absolute', top: 6, right: 6, width: phone ? 40 : 30, height: phone ? 40 : 30, borderRadius: '50%', border: 0, background: 'rgba(15,15,17,.62)', color: 'var(--il-fg)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <IconDots size={16} stroke={2.6} />
      </button>
    </div>
  );
}

function NewTile({ phone }: { phone: boolean }) {
  return (
    <button type="button" onClick={() => { useSessions.getState().create(); useRoute.getState().go('step'); }} className="il-home-new"
      style={{ breakInside: 'avoid', display: 'grid', placeItems: 'center', width: '100%', aspectRatio: phone ? '4 / 3' : '1', marginBottom: phone ? 10 : 12, borderRadius: 14, border: '2px dashed var(--il-line-strong)', background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ textAlign: 'center' }}>
        <IconPlus size={34} stroke={1.6} style={{ display: 'block', margin: '0 auto' }} />
        <span style={{ display: 'block', fontWeight: 800, fontSize: 12, marginTop: 4 }}>New session</span>
      </span>
    </button>
  );
}

const SEG: CSSProperties = { height: 28, padding: '0 12px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 11, fontWeight: 800, cursor: 'pointer' };

export function HomeScreen({ phone = false }: { phone?: boolean }) {
  const sessions = useSessions((s) => s.sessions);
  const openIds = useSessions((s) => s.openIds);
  const order = useHomeUi((u) => u.order);
  const setOrder = useHomeUi((u) => u.setOrder);
  const outputs = useSessionOutputs();
  const list = useMemo(() => (order === 'name' ? byName(Object.values(sessions)) : byRecent(Object.values(sessions))), [sessions, order]);
  const now = Date.now();
  return (
    <div className="il-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', padding: phone ? '12px 12px 96px' : '18px 22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', margin: 0 }}>Sessions</h1>
        <span style={{ color: 'var(--il-muted)', fontWeight: 700, fontSize: 12 }}>{list.length} · {order === 'name' ? 'by name' : 'newest first'}</span>
        <span role="radiogroup" aria-label="Order" style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 2, borderRadius: 999, background: 'var(--il-bg-deep)' }}>
          {(['recent', 'name'] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={order === o} onClick={() => setOrder(o)}
              style={{ ...SEG, height: phone ? 36 : 28, background: order === o ? 'var(--il-card-on)' : 'transparent', color: order === o ? 'var(--il-fg)' : 'var(--il-muted)' }}>
              {o === 'recent' ? 'Recent' : 'Name'}
            </button>
          ))}
        </span>
      </div>
      <div style={{ columnWidth: phone ? 150 : 220, columnGap: phone ? 10 : 12 }}>
        <NewTile phone={phone} />
        {list.map((s) => <Tile key={s.id} s={s} out={outputs[s.id]} isOpen={openIds.includes(s.id)} now={now} phone={phone} />)}
      </div>
    </div>
  );
}
