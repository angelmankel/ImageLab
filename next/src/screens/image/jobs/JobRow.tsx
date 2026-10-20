/**
 * Item 46: the job row — its own thin row between the canvas toolbar and the picture (never over
 * it). One chip per running / queued job, every step's: the step's number, what it is, ×N for a
 * batch, its progress (the chip fills ember as it runs), and × to cancel (running = interrupt,
 * waiting = taken off the server's queue). A tap on a chip goes to its step. The row slides open
 * when the first job arrives and folds away when the last one ends (the motion follows the theme's
 * `--il-motion`). Sideways scroll when there are many.
 */
import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useQueue, type QueueRow } from '~/app/queue';
import { useSteps } from '~/app/stepsStore';
import { useIsPhone } from '~/app/useIsPhone';
import { Tip, useWheelSideways } from '~/ui';

const ROW_H = 44;
const PHONE_ROW_H = 52;

function Chip({ row, index, onCancel, onOpen, phone }: { row: QueueRow; index: number | null; onCancel: () => void; onOpen: () => void; phone: boolean }) {
  const running = row.status === 'running';
  const pct = running && row.progress != null ? Math.round(row.progress * 100) : null;
  const h = phone ? 40 : 32;
  return (
    <div role="group" aria-label={`${row.label} · ${running ? (pct != null ? `${pct}%` : 'running') : 'queued'}`}
      style={{ position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', height: h, borderRadius: 999, overflow: 'hidden', maxWidth: 260,
        background: 'var(--il-card)', boxShadow: `inset 0 0 0 1px ${running ? 'var(--il-ember-line)' : 'var(--il-line-strong)'}` }}>
      {running && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, width: `${pct ?? 0}%`, background: 'var(--il-ember-soft)', transition: 'width .25s linear' }} />
      )}
      {running && pct == null && <div aria-hidden className="il-sweep" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, var(--il-ember-soft), transparent)' }} />}
      <button type="button" className="il-btn" onClick={onOpen} title={row.detail ?? row.label}
        style={{ position: 'relative', height: h, border: 0, background: 'transparent', color: 'var(--il-fg)', padding: '0 4px 0 6px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, fontWeight: 700 }}>
        <span aria-hidden style={{ width: h - 10, height: h - 10, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
          background: running ? 'var(--il-ember)' : 'var(--il-card-on)', color: running ? 'var(--il-bg)' : 'var(--il-muted)' }}>{index ?? '•'}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, maxWidth: 150 }}>{row.label}</span>
        {row.count && <span style={{ color: 'var(--il-ember-hi)', fontWeight: 800, flex: 'none' }}>×{row.count}</span>}
        <span style={{ color: running ? 'var(--il-ember-hi)' : 'var(--il-muted)', fontVariantNumeric: 'tabular-nums', flex: 'none', fontWeight: 800 }}>
          {running ? (pct != null ? `${pct}%` : '…') : 'queued'}
        </span>
      </button>
      <Tip label={running ? 'Stop this job' : 'Take it off the queue'}>
        <button type="button" className="il-btn" onClick={onCancel} aria-label={running ? 'Stop this job' : 'Take it off the queue'}
          style={{ position: 'relative', width: h, height: h, border: 0, background: 'transparent', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <IconX size={phone ? 16 : 14} stroke={2.4} />
        </button>
      </Tip>
    </div>
  );
}

export function JobRow() {
  const { rows, cancel } = useQueue();
  const steps = useSteps((s) => s.steps);
  const setActive = useSteps((s) => s.setActive);
  const phone = useIsPhone();
  const open = rows.length > 0;
  // Keep the last chips while the row folds away, so it closes with them instead of emptying first.
  const [shown, setShown] = useState<QueueRow[]>(rows);
  useEffect(() => {
    if (rows.length) { setShown(rows); return; }
    const t = window.setTimeout(() => setShown(rows), 320);
    return () => window.clearTimeout(t);
  }, [rows]);
  const scroller = useWheelSideways<HTMLDivElement>();
  const h = phone ? PHONE_ROW_H : ROW_H;
  return (
    <div aria-hidden={!open} style={{ flex: 'none', display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0,
      transition: 'grid-template-rows calc(.28s * var(--il-motion, 1)) ease, opacity calc(.2s * var(--il-motion, 1)) ease', borderBottom: open ? '1px solid var(--il-line)' : '0 solid transparent' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div ref={scroller} className="il-scroll" aria-label="Jobs"
          style={{ height: h, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x', scrollbarWidth: 'none' }}>
          {(open ? rows : shown).map((r) => {
            const i = r.stepId ? steps.findIndex((s) => s.id === r.stepId) : -1;
            return <Chip key={r.id} row={r} index={i >= 0 ? i + 1 : null} phone={phone} onCancel={() => cancel(r.id)} onOpen={() => { if (r.stepId && i >= 0) setActive(r.stepId); }} />;
          })}
        </div>
      </div>
    </div>
  );
}
